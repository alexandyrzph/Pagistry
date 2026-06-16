"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createBlock, createComponentInstance } from "@/lib/blocks/registry";
import { findBlockById, getDescendantIds } from "@/lib/blocks/tree";
import { useEditor } from "@/store/editor-store";
import { useCanvasZoom } from "@/store/canvas-zoom";
import type { DragInfo } from "./drag-context";
import type { FrameInfo } from "./iframe-context";

const EMPTY: DragInfo = { type: null, id: null, invalid: new Set(), ghost: null };

/**
 * Canvas drag-and-drop: dnd-kit sensors, a `measure` that maps iframe-internal
 * rects into top-document (zoom-scaled) coords, custom iframe auto-scroll, and the
 * drag start/end/cancel handlers. `frameRef` is the live canvas iframe handle.
 */
export function useDragDropManager(frameRef: RefObject<FrameInfo | null>) {
  const addBlock = useEditor((s) => s.addBlock);
  const addComponentInstance = useEditor((s) => s.addComponentInstance);
  const moveExisting = useEditor((s) => s.moveExisting);

  const [drag, setDrag] = useState<DragInfo>(EMPTY);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Translate a node's rect to top-document coords. Nodes inside the canvas
  // iframe are offset by the iframe's (scaled) position AND scaled by the canvas
  // zoom — their internal getBoundingClientRect is in unscaled iframe pixels,
  // so it must be multiplied by zoom to match the visually scaled iframe.
  const measure = useCallback((node: HTMLElement) => {
    const r = node.getBoundingClientRect();
    const fr = frameRef.current;
    if (fr && node.ownerDocument === fr.doc) {
      const z = useCanvasZoom.getState().zoom;
      const fb = fr.el.getBoundingClientRect();
      const left = fb.left + r.left * z;
      const top = fb.top + r.top * z;
      const width = r.width * z;
      const height = r.height * z;
      return { width, height, top, left, right: left + width, bottom: top + height };
    }
    return { width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }, []);

  // While dragging, make the iframe transparent to pointer events so the
  // top-document sensor keeps receiving pointermove over the canvas.
  const setFramePassthrough = (on: boolean) => {
    const el = frameRef.current?.el;
    if (!el) return;
    if (on) el.style.setProperty("pointer-events", "none");
    else el.style.removeProperty("pointer-events");
  };

  // Custom auto-scroll for the canvas iframe (dnd-kit only scrolls the top
  // document, not the iframe's own scroll context).
  const dragPointerY = useRef(0);
  const autoScrollRaf = useRef(0);
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    dragPointerY.current = e.clientY;
  }, []);
  const startAutoScroll = useCallback(() => {
    const EDGE = 80;
    const MAX = 20;
    const tick = () => {
      const fr = frameRef.current;
      const win = fr?.el.contentWindow;
      if (fr && win) {
        const r = fr.el.getBoundingClientRect();
        const y = dragPointerY.current;
        let dy = 0;
        if (y < r.top + EDGE) dy = -MAX * Math.min(1, (r.top + EDGE - y) / EDGE);
        else if (y > r.bottom - EDGE) dy = MAX * Math.min(1, (y - (r.bottom - EDGE)) / EDGE);
        if (dy) win.scrollBy(0, dy);
      }
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(autoScrollRaf.current);
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, []);
  const stopAutoScroll = useCallback(() => {
    cancelAnimationFrame(autoScrollRaf.current);
    window.removeEventListener("pointermove", onWindowPointerMove);
  }, [onWindowPointerMove]);

  // Safety net: if the editor unmounts mid-drag, dnd-kit won't fire end/cancel —
  // stop the auto-scroll rAF loop + pointermove listener on unmount.
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (!data) return;
    setFramePassthrough(true);
    window.addEventListener("pointermove", onWindowPointerMove);
    startAutoScroll();
    if (data.kind === "new") {
      const ghost = data.componentId
        ? createComponentInstance(data.componentId)
        : createBlock(data.blockType);
      setDrag({
        type: data.blockType,
        id: null,
        invalid: new Set(),
        ghost,
      });
    } else {
      const block = findBlockById(useEditor.getState().tree, data.blockId);
      const invalid = new Set<string>([data.blockId]);
      if (block) getDescendantIds(block).forEach((id) => invalid.add(id));
      setDrag({ type: data.blockType, id: data.blockId, invalid, ghost: block });
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDrag(EMPTY);
    setFramePassthrough(false);
    stopAutoScroll();
    const over = e.over;
    const a = e.active.data.current as any;
    if (!over || !a) return;
    const d = over.data.current as { parentId: string | null; index: number };
    if (!d) return;
    if (a.kind === "new") {
      if (a.componentId) addComponentInstance(a.componentId, d.parentId, d.index);
      else addBlock(a.blockType, d.parentId, d.index);
    } else {
      moveExisting(a.blockId, d.parentId, d.index);
    }
  };

  const onDragCancel = useCallback(() => {
    setDrag(EMPTY);
    setFramePassthrough(false);
    stopAutoScroll();
  }, [stopAutoScroll]);

  return { drag, sensors, measure, onDragStart, onDragEnd, onDragCancel };
}
