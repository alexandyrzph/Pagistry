"use client";

import { create } from "zustand";
import type { Editor } from "@tiptap/react";

// Bridges the Tiptap editor (which lives inside the canvas iframe) to the
// top-document formatting toolbar. `tick` bumps on selection/format changes so
// the toolbar re-reads position + active marks.

type S = {
  editor: Editor | null;
  tick: number;
  setEditor: (e: Editor | null) => void;
  bump: () => void;
};

export const useRichText = create<S>((set) => ({
  editor: null,
  tick: 0,
  setEditor: (editor) => set({ editor }),
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));
