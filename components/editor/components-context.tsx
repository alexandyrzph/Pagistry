"use client";

import { createContext, useContext } from "react";
import type { Block } from "@/lib/types";

export type ComponentItem = { id: string; name: string; content: Block[] };

type Ctx = {
  list: ComponentItem[];
  map: Record<string, ComponentItem>;
  refresh: () => Promise<void>;
};

const ComponentsCtx = createContext<Ctx>({
  list: [],
  map: {},
  refresh: async () => {},
});

export const ComponentsProvider = ComponentsCtx.Provider;
export const useComponents = () => useContext(ComponentsCtx);
