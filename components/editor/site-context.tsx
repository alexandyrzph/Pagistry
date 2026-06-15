"use client";

import { createContext, useContext } from "react";
import type { Block } from "@/lib/types";

// The shared site header + footer regions, exposed to the page editor so they
// can frame the page in Preview (and so their styles are included in the iframe).

type Ctx = {
  header: Block[];
  footer: Block[];
  refresh: () => Promise<void>;
};

const SiteCtx = createContext<Ctx>({ header: [], footer: [], refresh: async () => {} });

export const SiteProvider = SiteCtx.Provider;
export const useSite = () => useContext(SiteCtx);
