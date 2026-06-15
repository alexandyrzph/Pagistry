"use client";

import { createContext, useContext } from "react";
import type { CollectionData, CollectionMap } from "@/lib/types";

type Ctx = {
  list: CollectionData[];
  map: CollectionMap;
  refresh: () => Promise<void>;
};

const CollectionsCtx = createContext<Ctx>({
  list: [],
  map: {},
  refresh: async () => {},
});

export const CollectionsProvider = CollectionsCtx.Provider;
export const useCollections = () => useContext(CollectionsCtx);
