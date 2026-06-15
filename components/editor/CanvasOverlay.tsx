"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Component as ComponentIcon, Copy, GripVertical, Pencil, Trash2, Unlink } from "lucide-react";
import { getDefinition } from "@/lib/registry";
import { findBlockById } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useRichText } from "@/store/richtext";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useIframe, type FrameInfo } from "./iframe-context";
import { useComponents } from "./components-context";
import { useEditorActions } from "./editor-actions";
import { useDrag } from "./drag-context";

// Top-document layer drawn over the iframe: selection/hover outline + the block
// toolbar and drag handle. Positioned with the block's iframe-relative rect
// inside a container aligned to the iframe, so coords line up without offset.
export function CanvasOverlay() {
  const { frame, tick } = useIframe();
  const selectedId = useEditor((s) => s.selectedId);
  const selectedIds = useEditor((s) => s.selectedIds);
  const hoveredId = useEditor((s) => s.hoveredId);
  const previewMode = useEditor((s) => s.previewMode);
  const dragActive = !!useDrag().type;
  // While editing rich text, hide the selected block's toolbar so it doesn't
  // stack with the formatting toolbar / cover the text.
  const rtEditor = useRichText((s) => s.editor);
  const rtTick = useRichText((s) => s.tick);
  void rtTick;
  const editingText = !!rtEditor?.isFocused;
  const zoom = useCanvasZoom((s) => s.zoom);

  // `tick` is read so this re-renders (re-measures) on scroll/resize/relayout.
  void tick;

  // --- frame-perfect overlay sync ------------------------------------------
  // The chrome lives in the top document, so it can't share the iframe's scroll.
  // A scroll-EVENT-driven update always trails by a frame (the event fires after
  // the content already painted). Instead a rAF loop reads the LIVE iframe scroll
  // + screen rect every frame and positions the overlay BEFORE paint, so it lands
  // in the SAME frame as the content — zero trailing on any scroll source
  // (iframe-internal, the canvas container, or the window).
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const baseScroll = useRef({ x: 0, y: 0 });

  // Each commit re-measures block positions at the current scroll → capture that
  // scroll as the baseline the rAF transform is relative to (and clear any held
  // transform so the freshly-measured positions show un-offset for that frame).
  useLayoutEffect(() => {
    const win = frame?.el.contentWindow;
    if (!win) return;
    baseScroll.current = { x: win.scrollX, y: win.scrollY };
    if (contentRef.current) contentRef.current.style.transform = "";
  });

  const hasChrome = !!(selectedId || hoveredId || selectedIds.length);
  useEffect(() => {
    if (!frame || !hasChrome) return;
    let raf = 0;
    const sync = () => {
      const fr = frame.el;
      const win = fr.contentWindow;
      if (win) {
        const r = fr.getBoundingClientRect();
        const cont = containerRef.current;
        if (cont) {
          cont.style.top = `${r.top}px`;
          cont.style.left = `${r.left}px`;
          cont.style.width = `${r.width}px`;
          cont.style.height = `${r.height}px`;
        }
        const content = contentRef.current;
        if (content) {
          const dx = (win.scrollX - baseScroll.current.x) * zoom;
          const dy = (win.scrollY - baseScroll.current.y) * zoom;
          content.style.transform = `translate3d(${-dx}px, ${-dy}px, 0)`;
        }
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [frame, zoom, hasChrome]);

  if (!frame || previewMode) return null;

  const fb = frame.el.getBoundingClientRect();
  const showHover = hoveredId && hoveredId !== selectedId && !selectedIds.includes(hoveredId);
  const multi = selectedIds.length > 1;
  // Secondary selections (everything but the primary) get an outline only.
  const secondary = selectedIds.filter((id) => id !== selectedId);

  // Stay mounted during a drag (so the active draggable's hook isn't torn down,
  // which would cancel the drag) — just hide the chrome while dragging.
  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed z-30 overflow-hidden transition-opacity duration-100"
      style={{ top: fb.top, left: fb.left, width: fb.width, height: fb.height, opacity: dragActive ? 0 : 1 }}
    >
      <div ref={contentRef} className="absolute inset-0" style={{ willChange: "transform" }}>
        {showHover && <BlockChrome key={"h:" + hoveredId} blockId={hoveredId!} selected={false} frame={frame} dragActive={dragActive} hideToolbar={false} zoom={zoom} />}
        {secondary.map((id) => (
          <BlockChrome key={"m:" + id} blockId={id} selected frame={frame} dragActive={dragActive} hideToolbar zoom={zoom} />
        ))}
        {selectedId && <BlockChrome key={"s:" + selectedId} blockId={selectedId} selected frame={frame} dragActive={dragActive} hideToolbar={editingText || multi} zoom={zoom} />}
      </div>
    </div>
  );
}

function BlockChrome({
  blockId,
  selected,
  frame,
  dragActive,
  hideToolbar,
  zoom,
}: {
  blockId: string;
  selected: boolean;
  frame: FrameInfo;
  dragActive: boolean;
  hideToolbar: boolean;
  zoom: number;
}) {
  const router = useRouter();
  const block = useEditor((s) => findBlockById(s.tree, blockId));
  const remove = useEditor((s) => s.remove);
  const duplicate = useEditor((s) => s.duplicate);
  const detachComponent = useEditor((s) => s.detachComponent);
  const components = useComponents();
  const actions = useEditorActions();

  const isComponent = block?.type === "component";
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({
    id: blockId,
    data: { kind: "move", blockId, blockType: block?.type },
  });

  // Point the draggable node at the real block element inside the iframe so its
  // measured rect (translated to top-doc coords by DndContext) is the block.
  useEffect(() => {
    setNodeRef(frame.doc.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null);
  });

  // During a drag, stay mounted (keeps the active draggable's hook alive) but
  // render nothing — avoids getBoundingClientRect reflows on every frame.
  if (dragActive) return null;
  if (!block) return null;
  const el = frame.doc.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Hide chrome when the block is scrolled out of the iframe viewport (avoids a
  // stale toolbar stuck at the edge). Keep it mounted during a drag so the
  // active draggable's hook isn't torn down. (r and clientHeight are both in the
  // iframe's unscaled internal coordinate space, so compare before scaling.)
  if (!dragActive && (r.bottom <= 4 || r.top >= frame.el.clientHeight - 4)) return null;

  // The iframe renders at logical size and is visually scaled by `zoom`; the
  // overlay sits over the scaled iframe, so block rects are scaled to match.
  const sTop = r.top * zoom;
  const sLeft = r.left * zoom;
  const sW = r.width * zoom;
  const sH = r.height * zoom;

  const def = getDefinition(block.type);
  const comp = isComponent ? components.map[block.props?.componentId] : undefined;
  const label = isComponent ? comp?.name ?? "Component" : def?.label ?? block.type;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute rounded-[2px]",
          isComponent
            ? selected
              ? "outline outline-2 outline-violet-500"
              : "outline-dashed outline-1 outline-violet-300"
            : selected
              ? "outline outline-2 outline-indigo-500"
              : "outline-dashed outline-1 outline-indigo-300"
        )}
        style={{ top: sTop, left: sLeft, width: sW, height: sH, outlineOffset: -1 }}
      />

      {!hideToolbar && (
      <div
        className={cn(
          "pointer-events-auto absolute z-10 flex items-center gap-0.5 rounded-lg px-1 py-0.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-black/5",
          isComponent ? "bg-violet-600" : selected ? "bg-zinc-900" : "bg-zinc-900/85 backdrop-blur-sm"
        )}
        // Sit just ABOVE the block (top-left) so it never covers the content;
        // drop just inside the top edge when there's no room above. The toolbar
        // itself stays unscaled (readable at any zoom) — only its anchor scales.
        style={{ top: sTop >= 30 ? sTop - 28 : sTop + 4, left: Math.max(sLeft, 2) }}
        // The toolbar is pointer-events-auto, so it would otherwise swallow the
        // wheel; forward it to the iframe so scrolling over the toolbar scrolls
        // the canvas like everywhere else.
        onWheel={(e) => frame.el.contentWindow?.scrollBy({ left: e.deltaX, top: e.deltaY })}
      >
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="flex cursor-grab touch-none items-center rounded-md p-1 transition-colors hover:bg-white/15 active:cursor-grabbing"
          title="Drag to move"
          aria-label="Drag to move"
        >
          <GripVertical size={13} />
        </button>
        <span className="flex items-center gap-1 px-1">
          {isComponent && <ComponentIcon size={11} />}
          {label}
        </span>

        {isComponent ? (
          <>
            <ToolBtn title="Edit component" onClick={() => router.push(`/component/${block.props.componentId}`)}>
              <Pencil size={13} />
            </ToolBtn>
            <ToolBtn title="Detach" onClick={() => comp && detachComponent(block.id, comp.content)}>
              <Unlink size={13} />
            </ToolBtn>
          </>
        ) : (
          <ToolBtn title="Save as component" onClick={() => actions.saveAsComponent(block)}>
            <ComponentIcon size={13} />
          </ToolBtn>
        )}
        <ToolBtn title="Duplicate" onClick={() => duplicate(block.id)}>
          <Copy size={13} />
        </ToolBtn>
        <ToolBtn title="Delete" danger onClick={() => remove(block.id)}>
          <Trash2 size={13} />
        </ToolBtn>
      </div>
      )}
    </>
  );
}

function ToolBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      title={title}
      onClick={onClick}
      className={cn("rounded-md p-1 transition-colors hover:bg-white/15", danger && "hover:text-red-300")}
    >
      {children}
    </motion.button>
  );
}
