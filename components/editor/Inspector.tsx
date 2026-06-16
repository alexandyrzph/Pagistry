"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Component as ComponentIcon, Copy, GripVertical, PanelRight, Trash2, X } from "lucide-react";
import { getDefinition } from "@/lib/registry";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { useEditor, useSelectedBlock } from "@/store/editor-store";
import { useBreakpoints } from "@/store/breakpoints";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useEditorActions } from "./editor-actions";
import { useIframe } from "./iframe-context";
import { useDrag } from "./drag-context";
import { CUSTOM_INSPECTORS } from "./custom-inspectors";
import { StyleGroupView } from "./inspector/style-fields";
import {
  AttributesControl,
  ContentField,
  MotionSection,
  StyleActions,
  TextStyleControl,
  VisibilityControl,
  VP,
} from "./inspector/block-controls";

// --- inspector --------------------------------------------------------------

function InspectorContent({
  block,
  onHandlePointerDown,
  dragging,
  docked,
  onToggleDock,
}: {
  block: Block;
  onHandlePointerDown?: (e: React.PointerEvent) => void;
  dragging?: boolean;
  docked?: boolean;
  onToggleDock?: () => void;
}) {
  const [tab, setTab] = useState<"content" | "style">("content");
  const viewport = useEditor((s) => s.viewport);
  const { setActive } = useBreakpoints();
  const duplicate = useEditor((s) => s.duplicate);
  const remove = useEditor((s) => s.remove);
  const select = useEditor((s) => s.select);
  const actions = useEditorActions();

  const def = getDefinition(block.type);
  if (!def) return null;
  const Icon = def.icon;
  const Custom = CUSTOM_INSPECTORS[block.type] ?? def.CustomContent;

  return (
    <>
      {/* header (drag handle) */}
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 py-2 pl-2 pr-2">
        <div
          onPointerDown={onHandlePointerDown}
          className={cn(
            "flex flex-1 select-none items-center gap-2 rounded-lg py-0.5 pl-1 pr-2",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
          title="Drag to move panel"
        >
          <span className="flex items-center text-zinc-300">
            <GripVertical size={14} />
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon size={15} />
          </div>
          <span className="flex-1 truncate text-sm font-semibold tracking-tight text-zinc-800">{def.label}</span>
        </div>
        {block.type !== "component" && (
          <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-600" title="Save as component" onClick={() => actions.saveAsComponent(block)}>
            <ComponentIcon size={14} />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" title="Duplicate" onClick={() => duplicate(block.id)}>
          <Copy size={14} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Delete" onClick={() => remove(block.id)}>
          <Trash2 size={14} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          className={cn("rounded-lg p-1.5 transition-colors hover:bg-zinc-100", docked ? "text-indigo-600" : "text-zinc-400 hover:text-zinc-600")}
          title={docked ? "Float panel" : "Dock to right"}
          onClick={onToggleDock}
        >
          <PanelRight size={14} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" title="Close" onClick={() => select(null)}>
          <X size={14} />
        </motion.button>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 gap-1 border-b border-zinc-200 p-2">
        {(["content", "style"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-indigo-50 text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3"
        >
          {tab === "content" ? (
            <>
              {Custom ? (
                <Custom block={block} />
              ) : def.fields.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  This block has no content options — use Attributes below or the Style tab.
                </p>
              ) : (
                def.fields.map((f) => (
                  <ContentField key={f.key} field={f} blockId={block.id} value={(block.props as any)[f.key]} />
                ))
              )}
              <AttributesControl block={block} />
            </>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-500">Editing viewport</span>
                <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
                  {VP.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setActive(v.id)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium capitalize transition-colors",
                        viewport === v.id ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {v.icon}
                      {v.id}
                    </button>
                  ))}
                </div>
                {viewport !== "desktop" && (
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                    Overrides the desktop value on {viewport} and below.
                  </p>
                )}
              </div>
              <TextStyleControl block={block} />
              <StyleActions block={block} />
              <VisibilityControl block={block} />
              {def.styleGroups.map((g) => (
                <StyleGroupView key={g} group={g} />
              ))}
              <MotionSection block={block} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// --- floating panel positioning --------------------------------------------

const PANEL_WIDTH = 304;
const LEFT_PANEL = 256; // keep clear of the components panel
const GAP = 14;

type PanelPos = { left: number; top: number; maxHeight: number };

const DOCK_THRESHOLD = 60; // px from the right edge that triggers docking
const clampW = (w: number) => Math.max(264, Math.min(w, 560));

export function FloatingInspector() {
  const block = useSelectedBlock();
  const selectedId = useEditor((s) => s.selectedId);
  const tree = useEditor((s) => s.tree);
  const viewport = useEditor((s) => s.viewport);
  const previewMode = useEditor((s) => s.previewMode);
  const select = useEditor((s) => s.select);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [dragPos, setDragPos] = useState<PanelPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [docked, setDocked] = useState(false);
  const [dockHint, setDockHint] = useState(false);
  const [width, setWidth] = useState(PANEL_WIDTH);
  const { frame, tick } = useIframe();
  const zoom = useCanvasZoom((s) => s.zoom);
  const dragActive = !!useDrag().type;

  // While dragging/resizing the panel, make the canvas iframe transparent to
  // pointer events. Otherwise, when the cursor crosses into the cross-document
  // iframe it swallows pointermove/pointerup and the drag silently stops.
  const setFramePassthrough = (on: boolean) => {
    const el = frame?.el;
    if (!el) return;
    if (on) el.style.setProperty("pointer-events", "none");
    else el.style.removeProperty("pointer-events");
  };

  // re-anchor to the newly selected block (drop any manual float position)
  useEffect(() => {
    setDragPos(null);
  }, [selectedId]);

  // ESC closes the panel (deselect)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useEditor.getState().selectedId) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  function handlePointerDown(e: React.PointerEvent) {
    const vw = window.innerWidth;
    let base = dragPos ?? pos;
    if (docked) {
      // undock: pop out as a floating panel near the right edge
      base = { left: Math.max(8, vw - width - 16), top: 72, maxHeight: window.innerHeight - 88 };
      setDocked(false);
      setDragPos(base);
    }
    if (!base) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = base.left;
    const startTop = base.top;
    setDragging(true);
    setFramePassthrough(true);
    const onMove = (ev: PointerEvent) => {
      const left = Math.max(8, Math.min(startLeft + ev.clientX - startX, vw - width - 8));
      const top = Math.max(56, Math.min(startTop + ev.clientY - startY, window.innerHeight - 90));
      setDragPos({ left, top, maxHeight: window.innerHeight - top - 16 });
      setDockHint(ev.clientX > vw - DOCK_THRESHOLD);
    };
    const onUp = (ev: PointerEvent) => {
      setDragging(false);
      setFramePassthrough(false);
      if (ev.clientX > vw - DOCK_THRESHOLD) setDocked(true);
      setDockHint(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    e.preventDefault();
  }

  function handleResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const vw = window.innerWidth;
    const base = dragPos ?? pos;
    const rightEdge = docked ? vw : base ? base.left + width : vw - 8;
    setResizing(true);
    setFramePassthrough(true);
    const onMove = (ev: PointerEvent) => {
      const w = clampW(rightEdge - ev.clientX);
      setWidth(w);
      if (!docked && base) {
        setDragPos({ left: rightEdge - w, top: base.top, maxHeight: base.maxHeight });
      }
    };
    const onUp = () => {
      setResizing(false);
      setFramePassthrough(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const compute = useCallback(() => {
    if (!selectedId) return setPos(null);
    const doc = frame?.doc ?? document;
    const el = doc.querySelector(`[data-block-id="${selectedId}"]`);
    if (!el) return setPos(null);
    const r = el.getBoundingClientRect();
    // translate iframe-relative rect into top-document viewport coords. Blocks
    // inside the iframe are in unscaled internal px, so scale by the canvas zoom
    // to match the visually scaled iframe before offsetting by its position.
    const inFrame = !!(frame && el.ownerDocument === frame.doc);
    const off = inFrame ? frame!.el.getBoundingClientRect() : { left: 0, top: 0 };
    const sc = inFrame ? zoom : 1;
    const rect = { top: r.top * sc + off.top, left: r.left * sc + off.left, right: r.right * sc + off.left };
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    if (rect.right + GAP + width <= vw - 8) left = rect.right + GAP;
    else if (rect.left - GAP - width >= LEFT_PANEL + 8) left = rect.left - GAP - width;
    else left = vw - width - 8;

    const top = Math.max(64, Math.min(rect.top, vh - 360));
    setPos({ left, top, maxHeight: vh - top - 16 });
  }, [selectedId, width, frame, zoom]);

  useLayoutEffect(() => {
    compute();
  }, [compute, tree, viewport, tick]);

  useEffect(() => {
    if (!selectedId) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    // iframe-internal scroll doesn't propagate to the parent window, so listen on
    // the iframe's own window too (the canvas no longer bumps `tick` on scroll).
    const fw = frame?.el.contentWindow;
    fw?.addEventListener("scroll", onScroll, true);
    let ro: ResizeObserver | undefined;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el && "ResizeObserver" in window) {
      ro = new ResizeObserver(onScroll);
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      fw?.removeEventListener("scroll", onScroll, true);
      ro?.disconnect();
    };
  }, [selectedId, compute, frame]);

  const eff = dragPos ?? pos;
  const show = !!block && !previewMode && !dragActive && (docked || !!eff);

  const style: React.CSSProperties = docked
    ? { position: "fixed", top: 56, right: 0, bottom: 0, width }
    : {
        position: "fixed",
        left: eff?.left ?? 0,
        top: eff?.top ?? 64,
        width,
        maxHeight: eff?.maxHeight,
      };

  return (
    <>
      {/* dock-zone preview while dragging toward the right edge */}
      {dragging && dockHint && (
        <div
          className="pointer-events-none fixed z-[39] border-l-2 border-indigo-400 bg-indigo-500/10"
          style={{ top: 56, bottom: 0, right: 0, width }}
        />
      )}
      <AnimatePresence>
        {show && block && (
          <motion.aside
            key={block.id}
            initial={{ opacity: 0, scale: 0.97, x: docked ? 8 : -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={dragging || resizing ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34 }}
            style={style}
            className={cn(
              "z-40 flex flex-col overflow-hidden border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5",
              docked ? "border-l rounded-none" : "rounded-2xl border",
              (dragging || resizing) && "ring-indigo-300/60 select-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* resize handle on the left edge */}
            <div
              onPointerDown={handleResizeDown}
              className="group absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize"
              title="Drag to resize"
            >
              <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-indigo-400" />
            </div>
            <InspectorContent
              block={block}
              onHandlePointerDown={handlePointerDown}
              dragging={dragging}
              docked={docked}
              onToggleDock={() => setDocked((d) => !d)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
