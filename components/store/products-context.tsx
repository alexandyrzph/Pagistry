"use client";

import { createContext, useContext } from "react";
import type { ProductMap } from "@/lib/commerce/product-service";

const ProductsCtx = createContext<{ map: ProductMap }>({ map: {} });

export const ProductsProvider = ProductsCtx.Provider;
export const useProducts = () => useContext(ProductsCtx);
