"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Viewport } from "@/lib/types";

// ---------------------------------------------------------------------------
// Responsive breakpoints for the canvas / preview.
//
// The 3 defaults (desktop/tablet/mobile) map 1:1 onto the style buckets the
// inspector authors. Users can add custom breakpoints — extra preview widths
// that inherit a base bucket for chrome + style authoring. Custom breakpoints
// (and the active selection) persist in localStorage across sessions.
// ---------------------------------------------------------------------------

export type Breakpoint = {
  id: string;
  label: string;
  width: number;
  /** which style bucket this breakpoint authors / inherits (desktop|tablet|mobile) */
  base: Viewport;
  custom?: boolean;
};

export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: "desktop", label: "Desktop", width: 1280, base: "desktop" },
  { id: "tablet", label: "Tablet", width: 820, base: "tablet" },
  { id: "mobile", label: "Mobile", width: 390, base: "mobile" },
];

export const MIN_WIDTH = 240;
export const MAX_WIDTH = 3840;
export const clampWidth = (w: number) => Math.max(MIN_WIDTH, Math.min(Math.round(w), MAX_WIDTH));

/** Which style bucket / device chrome a given width maps to. */
export const baseFor = (w: number): Viewport => (w >= 1024 ? "desktop" : w >= 640 ? "tablet" : "mobile");

type State = {
  custom: Breakpoint[];
  activeId: string;
  /** transient free-drag width (resize handles) overriding the active breakpoint */
  dragWidth: number | null;
  setActive: (id: string) => void;
  setDragWidth: (w: number | null) => void;
  addBreakpoint: (bp: { label?: string; width: number; base: Viewport }) => string;
  removeBreakpoint: (id: string) => void;
};

let seq = 0;
const genId = () => `bp_${Date.now().toString(36)}${(seq++).toString(36)}`;

const useBreakpointStore = create<State>()(
  persist(
    (set) => ({
      custom: [],
      activeId: "desktop",
      dragWidth: null,
      // selecting a preset breakpoint clears the free-drag override
      setActive: (id) => set({ activeId: id, dragWidth: null }),
      setDragWidth: (w) => set({ dragWidth: w == null ? null : clampWidth(w) }),
      addBreakpoint: ({ label, width, base }) => {
        const id = genId();
        const w = clampWidth(width);
        set((s) => ({
          custom: [...s.custom, { id, label: label?.trim() || `${w}px`, width: w, base, custom: true }],
          activeId: id,
          dragWidth: null,
        }));
        return id;
      },
      removeBreakpoint: (id) =>
        set((s) => ({
          custom: s.custom.filter((b) => b.id !== id),
          activeId: s.activeId === id ? "desktop" : s.activeId,
          dragWidth: null,
        })),
    }),
    {
      name: "pc-breakpoints",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as any)
      ),
      partialize: (s) => ({ custom: s.custom, activeId: s.activeId }),
    }
  )
);

/** Combined list of default + custom breakpoints, plus actions. */
export function useBreakpoints() {
  const custom = useBreakpointStore((s) => s.custom);
  const activeId = useBreakpointStore((s) => s.activeId);
  const dragWidth = useBreakpointStore((s) => s.dragWidth);
  const setActive = useBreakpointStore((s) => s.setActive);
  const setDragWidth = useBreakpointStore((s) => s.setDragWidth);
  const addBreakpoint = useBreakpointStore((s) => s.addBreakpoint);
  const removeBreakpoint = useBreakpointStore((s) => s.removeBreakpoint);

  const list = [...DEFAULT_BREAKPOINTS, ...custom];
  const base = list.find((b) => b.id === activeId) ?? DEFAULT_BREAKPOINTS[0];
  // While the resize handles are in use, override the active width/base so the
  // whole canvas (chrome, style bucket, zoom-fit, readout) follows the free drag.
  const active =
    dragWidth != null ? { ...base, width: dragWidth, base: baseFor(dragWidth) } : base;
  return { list, custom, active, dragWidth, setActive, setDragWidth, addBreakpoint, removeBreakpoint };
}
