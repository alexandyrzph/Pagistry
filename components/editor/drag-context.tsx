"use client";

import { createContext, useContext } from "react";
import type { Block } from "@/lib/types";

export type DragInfo = {
  /** block type currently being dragged (palette or move), or null */
  type: string | null;
  /** id of the existing block being moved, or null for new-from-palette */
  id: string | null;
  /** parent ids that may NOT receive the drop (dragged block + descendants) */
  invalid: Set<string>;
  /** live preview block rendered at the would-be drop location */
  ghost: Block | null;
};

const DragCtx = createContext<DragInfo>({
  type: null,
  id: null,
  invalid: new Set(),
  ghost: null,
});

export const DragProvider = DragCtx.Provider;
export const useDrag = () => useContext(DragCtx);
