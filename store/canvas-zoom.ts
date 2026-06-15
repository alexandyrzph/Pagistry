"use client";

import { create } from "zustand";

// Canvas zoom — the visual scale of the device frame. Kept out of the document
// store so it never lands in undo history. The overlay / dnd coordinate math
// reads this imperatively (via getState) when mapping iframe-internal pixels to
// top-document pixels, so the selection chrome, block toolbar, floating
// inspector and drag droppables all stay aligned with the *visually scaled*
// iframe rather than its unscaled internal coordinate system.

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;

// Snap points used by the +/- buttons and the ⌘+/⌘- shortcuts.
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 1.75, 2];

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

type ZoomState = {
  zoom: number;
  /** Available canvas content width (px) — reported by Canvas for "fit". */
  viewportWidth: number;
  setZoom: (z: number) => void;
  setViewportWidth: (w: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

export const useCanvasZoom = create<ZoomState>((set, get) => ({
  zoom: 1,
  viewportWidth: 0,
  setZoom: (z) => set({ zoom: clamp(z) }),
  setViewportWidth: (w) => set({ viewportWidth: w }),
  zoomIn: () => {
    const z = get().zoom;
    set({ zoom: clamp(STEPS.find((s) => s > z + 0.001) ?? ZOOM_MAX) });
  },
  zoomOut: () => {
    const z = get().zoom;
    set({ zoom: clamp([...STEPS].reverse().find((s) => s < z - 0.001) ?? ZOOM_MIN) });
  },
  reset: () => set({ zoom: 1 }),
}));
