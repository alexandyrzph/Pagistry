"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useEditor, useSelectedBlock } from "@/store/editor-store";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useIframe } from "../iframe-context";
import { useDrag } from "../drag-context";

const PANEL_WIDTH = 304;
const LEFT_PANEL = 256; // keep clear of the components panel
const GAP = 14;
const DOCK_THRESHOLD = 60; // px from the right edge that triggers docking
const clampW = (w: number) => Math.max(264, Math.min(w, 560));

type PanelPos = { left: number; top: number; maxHeight: number };

/**
 * Drives the floating inspector panel: tracks the selected block, computes the
 * anchored position (translating iframe-internal rects to top-document/zoom
 * coords), and handles drag-to-move, edge-resize, dock-to-right, ESC-to-close,
 * and live repositioning on scroll/resize/zoom.
 */
export function useFloatingPanel() {
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

  const toggleDock = useCallback(() => setDocked((d) => !d), []);

  return {
    block,
    show,
    style,
    width,
    dragging,
    resizing,
    docked,
    dockHint,
    handlePointerDown,
    handleResizeDown,
    toggleDock,
  };
}
