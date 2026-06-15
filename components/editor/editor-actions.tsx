"use client";

import { createContext, useContext } from "react";
import type { Block } from "@/lib/types";

export type EditorActions = {
  /** Switch to another page in place (no full reload), guarding unsaved changes. */
  switchPage: (id: string) => void;
  /** Run `action` after resolving any unsaved changes. */
  confirmLeave: (action: () => void) => void;
  /** Load a page's content into the editor in place (no route navigation). */
  loadPageInPlace: (id: string) => Promise<void>;
  /** Open the "save as component" dialog for a block. */
  saveAsComponent: (block: Block) => void;
};

const Ctx = createContext<EditorActions>({
  switchPage: () => {},
  confirmLeave: (a) => a(),
  loadPageInPlace: async () => {},
  saveAsComponent: () => {},
});

export const EditorActionsProvider = Ctx.Provider;
export const useEditorActions = () => useContext(Ctx);
