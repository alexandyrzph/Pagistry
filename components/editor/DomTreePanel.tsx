"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripHorizontal, Maximize2, Move, Network, PanelBottom, StretchHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefinition } from "@/lib/registry";
import { blockHtmlClass, blockHtmlId } from "@/lib/styles";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { useIframe } from "./iframe-context";

// Maps a block type to the HTML tag it renders as (its root element), so the
// panel reads like a real DOM/elements tree rather than the friendly labels the
// Layers panel already provides.
const TAGS: Record<string, string> = {
  section: "section", hero: "section", features: "section", pricing: "section",
  testimonial: "section", stats: "section", cta: "section", form: "form",
  collection: "section", footer: "footer", navbar: "nav",
  text: "div", button: "a", image: "img", icon: "div", video: "div",
  list: "ul", quote: "blockquote", columns: "div", column: "div",
  spacer: "div", divider: "div", file: "div", embed: "div", code: "div",
  component: "div",
};

function tagFor(block: Block): string {
  if (block.type === "heading") return String(block.props?.level ?? "h2");
  return TAGS[block.type] ?? "div";
}

function countNodes(tree: Block[]): number {
  return tree.reduce((n, b) => n + 1 + countNodes(b.children), 0);
}

type Mode = "dock" | "full" | "float";
type Float = { x: number; y: number; w: number; h: number };

const DRAG_THRESHOLD = 5; // px the pointer must move before a drag/detach starts
const DOCK_ZONE = 90; // px from the bottom edge that re-docks the panel

function DomNode({ block, depth }: { block: Block; depth: number }) {
  const def = getDefinition(block.type);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const hover = useEditor((s) => s.hover);

  const tag = tagFor(block);
  const htmlId = blockHtmlId(block);
  // de-dupe classes so the same name typed twice doesn't render twice
  const classList = [...new Set(blockHtmlClass(block).split(/\s+/).filter(Boolean))].join(" ");
  const selected = selectedId === block.id;
  const hovered = hoveredId === block.id;
  const text = block.props?.text || block.props?.title || block.props?.brand;

  return (
    <>
      <div
        onClick={() => select(block.id)}
        onMouseEnter={() => hover(block.id)}
        onMouseLeave={() => hover(null)}
        style={{ paddingLeft: 10 + depth * 14 }}
        className={cn(
          "cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded py-[3px] pr-2 font-mono text-[12px] leading-5 transition-colors",
          selected ? "bg-indigo-100" : hovered ? "bg-zinc-100" : "hover:bg-zinc-100"
        )}
      >
        <span className="text-zinc-400">&lt;</span>
        <span className="text-rose-600">{tag}</span>
        {htmlId && (
          <>
            <span className="text-violet-600">{" "}id</span>
            <span className="text-zinc-400">=</span>
            <span className="text-sky-700">&quot;{htmlId}&quot;</span>
          </>
        )}
        {classList && (
          <>
            <span className="text-violet-600">{" "}class</span>
            <span className="text-zinc-400">=</span>
            <span className="text-sky-700">&quot;{classList}&quot;</span>
          </>
        )}
        <span className="mr-1 text-zinc-400">&gt;</span>
        {!def && <span className="text-zinc-300">?</span>}
        {text && <span className="truncate text-zinc-400">{String(text).slice(0, 40)}</span>}
      </div>
      {block.children.map((c) => (
        <DomNode key={c.id} block={c} depth={depth + 1} />
      ))}
    </>
  );
}

export function DomTreePanel() {
  const open = useEditorUI((s) => s.domTree);
  const close = useEditorUI((s) => s.closeDomTree);
  const tree = useEditor((s) => s.tree);
  const { frame } = useIframe();

  const [mode, setMode] = useState<Mode>("dock");
  const [height, setHeight] = useState(320); // docked height (px)
  const [flt, setFlt] = useState<Float>({ x: 0, y: 0, w: 460, h: 380 });
  const [dragging, setDragging] = useState(false);
  const [dockHint, setDockHint] = useState(false);
  const fltInit = useRef(false);
  const lastDock = useRef<Mode>("dock"); // which docked mode to restore on re-dock

  // While dragging/resizing, make the iframe pointer-inert so it doesn't
  // swallow pointermove/up (same gotcha the FloatingInspector handles).
  const passthrough = (on: boolean) => {
    const el = frame?.el;
    if (!el) return;
    if (on) el.style.setProperty("pointer-events", "none");
    else el.style.removeProperty("pointer-events");
  };

  const ensureFloat = (): Float => {
    if (!fltInit.current) {
      fltInit.current = true;
      const w = Math.min(520, window.innerWidth - 360);
      const next = { x: window.innerWidth - w - 24, y: 80, w, h: 420 };
      setFlt(next);
      return next;
    }
    return flt;
  };

  // Drag the header. A plain click does nothing; only once the pointer moves past
  // DRAG_THRESHOLD does it start dragging — detaching a docked panel into a
  // floating one under the cursor. Releasing over the bottom dock zone re-docks it.
  const onHeaderDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const sx = e.clientX, sy = e.clientY;
    const startMode = mode;
    const startFlt = flt;
    let started = false;
    let grabX = 0, grabY = 0; // cursor offset within the floating panel

    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        started = true;
        setDragging(true);
        passthrough(true);
        if (startMode === "float") {
          grabX = sx - startFlt.x;
          grabY = sy - startFlt.y;
        } else {
          // detach: pop out under the cursor (cursor near the title), keep size
          const w = fltInit.current ? startFlt.w : Math.min(520, window.innerWidth - 360);
          const h = fltInit.current ? startFlt.h : 420;
          fltInit.current = true;
          grabX = Math.min(90, w - 40);
          grabY = 16;
          setMode("float");
          setFlt({ x: ev.clientX - grabX, y: ev.clientY - grabY, w, h });
        }
      }
      const x = Math.max(8, Math.min(ev.clientX - grabX, window.innerWidth - 120));
      const y = Math.max(56, Math.min(ev.clientY - grabY, window.innerHeight - 60));
      setFlt((f) => ({ ...f, x, y }));
      setDockHint(ev.clientY > window.innerHeight - DOCK_ZONE);
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!started) return; // it was a click, not a drag — leave mode unchanged
      setDragging(false);
      passthrough(false);
      setDockHint(false);
      if (ev.clientY > window.innerHeight - DOCK_ZONE) setMode(lastDock.current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Resize handles. `dims` selects which dimensions an edge affects.
  const onResizeDown = (e: React.PointerEvent, dims: "h-top" | "w" | "h" | "wh") => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const start = { height, w: flt.w, h: flt.h };
    passthrough(true);
    const move = (ev: PointerEvent) => {
      if (dims === "h-top") {
        // docked: dragging the top edge up grows the panel
        setHeight(Math.max(140, Math.min(start.height + (sy - ev.clientY), window.innerHeight - 100)));
      } else {
        setFlt((f) => ({
          ...f,
          w: dims === "w" || dims === "wh" ? Math.max(280, Math.min(start.w + (ev.clientX - sx), window.innerWidth - f.x - 8)) : f.w,
          h: dims === "h" || dims === "wh" ? Math.max(160, Math.min(start.h + (ev.clientY - sy), window.innerHeight - f.y - 8)) : f.h,
        }));
      }
    };
    const up = () => {
      passthrough(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const float = mode === "float";

  // For docked modes leave left/right to classes (inline left:0 would override
  // the lg:left-[294px] canvas offset); only set bottom/height inline.
  const positionStyle: React.CSSProperties = float
    ? { left: flt.x, top: flt.y, width: flt.w, height: flt.h }
    : { bottom: 0, height };

  const selectMode = (m: Mode) => {
    if (m === "float") {
      ensureFloat();
      setMode("float");
    } else {
      lastDock.current = m;
      setMode(m);
    }
  };

  const ModeBtn = ({ m, icon, title }: { m: Mode; icon: React.ReactNode; title: string }) => (
    <button
      data-no-drag
      onClick={() => selectMode(m)}
      title={title}
      className={cn(
        "rounded-md p-1 transition-colors",
        mode === m ? "bg-indigo-100 text-indigo-600" : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
      )}
    >
      {icon}
    </button>
  );

  return (
    <>
      {/* dock-zone preview while dragging toward the bottom edge — animates in
          with a spring fade/slide and shows a "drop to dock" affordance. */}
      <AnimatePresence>
        {open && dragging && dockHint && (
          <motion.div
            key="dock-zone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn(
              "pointer-events-none fixed bottom-0 right-0 z-[34] flex h-28 items-end justify-center border-t-2 border-dashed border-indigo-400 bg-gradient-to-t from-indigo-500/15 to-transparent",
              lastDock.current === "dock" ? "left-0 lg:left-[294px]" : "left-0"
            )}
          >
            <motion.span
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="mb-4 flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-lg"
            >
              <PanelBottom size={12} /> Drop to dock
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    <AnimatePresence>
      {open && (
        <motion.aside
          // keyed on dock-vs-float so detaching/re-docking replays the entrance
          // animation (a pop when it detaches, a slide-up when it re-docks).
          // Position/size are inline styles (not framer-animated), so dragging
          // and resizing stay instant regardless of this transition.
          key={float ? "domtree-float" : "domtree-dock"}
          initial={float ? { opacity: 0, scale: 0.9, y: 8 } : { y: "100%" }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={float ? { opacity: 0, scale: 0.92 } : { opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 460, damping: 34 }}
          className={cn(
            "fixed z-[35] flex flex-col border-zinc-200 bg-white",
            float
              ? "rounded-xl border shadow-2xl ring-1 ring-black/5"
              : cn(
                  "right-0 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.08)]",
                  mode === "dock" ? "left-0 lg:left-[294px]" : "left-0"
                )
          )}
          style={positionStyle}
        >
          {/* top resize handle (docked modes) */}
          {!float && (
            <div
              onPointerDown={(e) => onResizeDown(e, "h-top")}
              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
              title="Drag to resize"
            />
          )}

          {/* header (drag to move / detach) */}
          <div
            onPointerDown={onHeaderDown}
            className={cn(
              "flex h-9 shrink-0 select-none items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3",
              float ? "cursor-grab active:cursor-grabbing" : "cursor-grab"
            )}
          >
            <Network size={14} className="text-indigo-500" />
            <span className="text-xs font-bold tracking-tight text-zinc-700">DOM tree</span>
            <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500">
              {countNodes(tree)} elements
            </span>
            {float && <GripHorizontal size={14} className="ml-1 text-zinc-300" />}
            <div className="ml-auto flex items-center gap-0.5">
              <ModeBtn m="dock" icon={<PanelBottom size={14} />} title="Dock to canvas" />
              <ModeBtn m="full" icon={<StretchHorizontal size={14} />} title="Full width" />
              <ModeBtn m="float" icon={<Move size={14} />} title="Detach / float" />
              <div className="mx-1 h-4 w-px bg-zinc-200" />
              <button
                data-no-drag
                onClick={close}
                title="Hide DOM tree"
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* tree */}
          <div className="min-h-0 flex-1 overflow-auto py-1.5">
            {tree.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-400">No elements yet — add a block to see the DOM tree.</p>
            ) : (
              tree.map((b) => <DomNode key={b.id} block={b} depth={0} />)
            )}
          </div>

          {/* float resize handles: right edge, bottom edge, SE corner */}
          {float && (
            <>
              <div onPointerDown={(e) => onResizeDown(e, "w")} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" />
              <div onPointerDown={(e) => onResizeDown(e, "h")} className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" />
              <div
                onPointerDown={(e) => onResizeDown(e, "wh")}
                className="absolute bottom-0 right-0 flex h-3.5 w-3.5 cursor-nwse-resize items-end justify-end p-0.5"
                title="Resize"
              >
                <Maximize2 size={9} className="rotate-90 text-zinc-300" />
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
    </>
  );
}
