"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export type ClientCart = {
  id?: string;
  items: { id: string; variantId: string; quantity: number; unitAmount: number }[];
};

type Ctx = {
  cart: ClientCart;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartCtx = createContext<Ctx>({
  cart: { items: [] },
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  refresh: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ClientCart>({ items: [] });
  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    const { data } = await api.post<{ cart: ClientCart }>(endpoints.cart.items, {
      variantId,
      quantity,
    });
    setCart(data.cart);
  }, []);
  const updateItem = useCallback(async (id: string, quantity: number) => {
    const { data } = await api.patch<{ cart: ClientCart }>(endpoints.cart.item(id), { quantity });
    setCart(data.cart);
  }, []);
  const removeItem = useCallback(async (id: string) => {
    const { data } = await api.delete<{ cart: ClientCart }>(endpoints.cart.item(id));
    setCart(data.cart);
  }, []);
  const refresh = useCallback(async () => {
    const { data } = await api.get<{ cart: ClientCart }>(endpoints.cart.root);
    setCart(data.cart);
  }, []);
  useEffect(() => {
    api
      .get<{ cart: ClientCart }>(endpoints.cart.root)
      .then((r) => setCart(r.data.cart))
      .catch(() => {});
  }, []);
  return (
    <CartCtx.Provider value={{ cart, addItem, updateItem, removeItem, refresh }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
