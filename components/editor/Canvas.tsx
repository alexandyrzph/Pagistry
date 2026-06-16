"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useBreakpoints } from "@/store/breakpoints";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { BlockRenderer } from "@/components/BlockRenderer";
import { SlottedChildren } from "./EditorBlock";
import { DeviceFrame } from "./DeviceFrame";
import { CanvasFrame } from "./CanvasFrame";
import { DeviceResizer } from "./DeviceResizer";
import { useComponents } from "./components-context";
import { useCollections } from "./collections-context";
import { useSite } from "./site-context";
import { useIframe } from "./iframe-context";

export function Canvas() {
  const tree = useEditor((s) => s.tree);
  const previewMode = useEditor((s) => s.previewMode);
  const slug = useEditor((s) => s.slug);
  const theme = useEditor((s) => s.theme);
  const pageId = useEditor((s) => s.pageId);
  const select = useEditor((s) => s.select);
  const setViewport = useEditor((s) => s.setViewport);
  const components = useComponents();
  const collections = useCollections();
  const site = useSite();
  const { active, setDragWidth } = useBreakpoints();
  const zoom = useCanvasZoom((s) => s.zoom);
  const setZoom = useCanvasZoom((s) => s.setZoom);
  const setViewportWidth = useCanvasZoom((s) => s.setViewportWidth);
  const { frame } = useIframe();
  const [resizeSide, setResizeSide] = useState<"left" | "right" | null>(null);
  const resizing = resizeSide !== null;

  // Drag-to-resize the preview width via the side "pipes". Centered device, so a
  // drag of dx on one side changes the width by 2·dx (divided by zoom, since the
  // device is visually scaled) to keep that edge under the cursor.
  const startResize = (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startW = active.width;
    setResizeSide(side);
    const fr = frame?.el;
    fr?.style.setProperty("pointer-events", "none");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      setDragWidth(startW + ((side === "right" ? dx : -dx) * 2) / zoom);
    };
    const end = () => {
      setResizeSide(null);
      fr?.style.removeProperty("pointer-events");
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
    };
    // With pointer capture, events stay on the handle even when the cursor
    // crosses the iframe — window listeners alone lose the drag over iframes.
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  // Measure the scrollable canvas area so the zoomed device gets a correctly
  // sized scroll footprint (CSS transforms don't affect layout/scroll area) and
  // so the zoom control can offer "fit to width".
  const scrollRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const w = el.clientWidth - padX;
      const h = el.clientHeight - padY;
      setAvail({ w, h });
      setViewportWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewportWidth]);

  // Auto-fit: when a breakpoint is wider than the canvas area, fit it to width on
  // load and on every breakpoint switch (so it never overflows by default).
  // Keyed on the breakpoint id so manual zoom + resizes afterward are preserved
  // until the next switch.
  const lastFitKey = useRef("");
  useEffect(() => {
    if (!avail.w) return;
    if (lastFitKey.current === active.id) return; // already fit this breakpoint
    lastFitKey.current = active.id;
    const fit = avail.w / active.width;
    setZoom(fit < 0.999 ? fit : 1);
  }, [active.id, active.width, avail.w, setZoom]);

  // Authoring viewport follows the active breakpoint's base bucket.
  useEffect(() => {
    setViewport(active.base);
  }, [active.id, active.base, setViewport]);

  const width = active.width;

  // Stable reference so CanvasFrame's CSS effect doesn't loop.
  const cssExtra = useMemo(
    () => (previewMode ? [...site.header, ...site.footer] : undefined),
    [previewMode, site.header, site.footer]
  );

  // Content is portaled into the iframe by CanvasFrame.
  const content = previewMode ? (
    <>
      {site.header.length > 0 && (
        <BlockRenderer tree={site.header} viewport="desktop" animate inlineStyles={false} components={components.map} collections={collections.map} />
      )}
      <BlockRenderer
        tree={tree}
        viewport="desktop"
        animate
        inlineStyles={false}
        components={components.map}
        collections={collections.map}
      />
      {site.footer.length > 0 && (
        <BlockRenderer tree={site.footer} viewport="desktop" animate inlineStyles={false} components={components.map} collections={collections.map} />
      )}
    </>
  ) : tree.length === 0 ? (
    <div className="p-8">
      <SlottedChildren parentId={null} parentType="root" items={tree} emptyMinHeight={360} />
    </div>
  ) : (
    <>
      <SlottedChildren parentId={null} parentType="root" items={tree} />
      <div className="flex justify-center px-8 py-6">
        <button
          data-open-inserter="root"
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-white/70 px-4 py-2.5 text-sm font-semibold text-zinc-500 shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
        >
          <span className="text-base leading-none">+</span> Add section
        </button>
      </div>
    </>
  );

  return (
    <div
      ref={scrollRef}
      className="relative flex flex-1 overflow-auto overscroll-none bg-zinc-100 p-6 lg:p-10"
      onClick={() => select(null)}
    >
      {/* Scroll footprint: takes the device's *scaled* size so overflow-auto can
          reveal a zoomed-in canvas. The inner box keeps the device's logical
          size and is visually scaled with a transform. While actively resizing,
          width transitions are off so the device tracks the cursor 1:1. */}
      <div
        className={cn(
          "relative mx-auto h-full shrink-0",
          !resizing && "transition-[width] duration-300 ease-out"
        )}
        style={{ width: width * zoom, height: avail.h ? avail.h * zoom : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "h-full origin-top-left will-change-transform",
            !resizing && "transition-[width,transform] duration-300 ease-out"
          )}
          style={{
            width,
            height: avail.h || undefined,
            transform: `scale(${zoom})`,
          }}
        >
          <DeviceFrame viewport={active.base} slug={slug}>
            <CanvasFrame tree={tree} theme={theme} editable={!previewMode} cssExtra={cssExtra}>
              <motion.div
                key={(pageId ?? "page") + (previewMode ? ":preview" : ":edit")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="min-h-full"
              >
                {content}
              </motion.div>
            </CanvasFrame>
          </DeviceFrame>
        </div>

        {/* drag-to-resize "pipes" on each side of the device (edit mode only) */}
        {!previewMode && (
          <>
            <DeviceResizer side="left" width={active.width} resizing={resizeSide === "left"} onPointerDown={startResize("left")} />
            <DeviceResizer side="right" width={active.width} resizing={resizeSide === "right"} onPointerDown={startResize("right")} />
          </>
        )}
      </div>
    </div>
  );
}
