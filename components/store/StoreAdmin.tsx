"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { ProductEditor, type EditableProduct } from "./ProductEditor";

type Store = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  currency: string;
  taxEnabled: boolean;
} | null;

export function StoreAdmin({
  initialStore,
  initialProducts,
}: {
  initialStore: Store;
  initialProducts: EditableProduct[];
}) {
  const [store] = useState<Store>(initialStore);
  const [products, setProducts] = useState<EditableProduct[]>(initialProducts);
  const [editing, setEditing] = useState<EditableProduct | null>(null);

  async function connect() {
    const { data } = await api.post<{ url: string }>(endpoints.store.connect, {});
    window.location.href = data.url;
  }
  async function create() {
    const title = window.prompt("Product title", "New product");
    if (!title) return;
    const { data } = await api.post<{ product: EditableProduct }>(endpoints.products.list, {
      title,
    });
    setProducts((p) => [data.product, ...p]);
    setEditing(data.product);
  }
  async function refresh() {
    const { data } = await api.get<{ products: EditableProduct[] }>(endpoints.products.list);
    setProducts(data.products);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Store</h1>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" onClick={create}>
          New product
        </button>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-medium">Stripe</div>
        {store?.chargesEnabled ? (
          <div className="mt-1 text-sm text-green-600">Connected — charges enabled</div>
        ) : (
          <button className="mt-2 rounded-lg border px-3 py-1.5 text-sm" onClick={connect}>
            {store?.stripeAccountId ? "Finish Stripe onboarding" : "Connect Stripe"}
          </button>
        )}
      </div>

      <div className="divide-y rounded-xl border border-slate-200">
        {products.map((p) => (
          <button
            key={p.id}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50"
            onClick={() => setEditing(p)}
          >
            <span className="font-medium">{p.title}</span>
            <span className="text-xs uppercase text-slate-400">{p.status}</span>
          </button>
        ))}
        {products.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">No products yet.</div>
        )}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
