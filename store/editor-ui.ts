"use client";

import { create } from "zustand";

// Transient editor UI: the block context menu + the "add section" inserter.
// Kept out of the document store so it never lands in history/undo.

type InserterTarget = { parentId: string | null; index: number };

type EditorUI = {
  ctx: { x: number; y: number; blockId: string } | null;
  openCtx: (x: number, y: number, blockId: string) => void;
  closeCtx: () => void;

  inserter: InserterTarget | null;
  openInserter: (target?: InserterTarget) => void;
  closeInserter: () => void;

  ai: InserterTarget | null;
  openAi: (target?: InserterTarget) => void;
  closeAi: () => void;

  // DOM-tree preview drawer (toggleable from the toolbar)
  domTree: boolean;
  toggleDomTree: () => void;
  closeDomTree: () => void;
};

export const useEditorUI = create<EditorUI>((set) => ({
  ctx: null,
  openCtx: (x, y, blockId) => set({ ctx: { x, y, blockId }, inserter: null }),
  closeCtx: () => set({ ctx: null }),

  inserter: null,
  openInserter: (target) => set({ inserter: target ?? { parentId: null, index: -1 }, ctx: null }),
  closeInserter: () => set({ inserter: null }),

  ai: null,
  openAi: (target) => set({ ai: target ?? { parentId: null, index: -1 }, ctx: null, inserter: null }),
  closeAi: () => set({ ai: null }),

  domTree: false,
  toggleDomTree: () => set((s) => ({ domTree: !s.domTree })),
  closeDomTree: () => set({ domTree: false }),
}));
