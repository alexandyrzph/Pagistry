"use client";

import { useState } from "react";
import axios from "axios";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { formatMoney } from "@/lib/commerce/pricing";
import { Button } from "@/components/ui/Button";
import { Table, TableContainer, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { useConfirm, useAlert } from "@/components/ui/dialog-provider";
import { ProductEditor, type EditableProduct } from "./ProductEditor";

type Store = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  currency: string;
  taxEnabled: boolean;
} | null;

const STATUS_PILL: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  draft: "bg-zinc-100 text-zinc-600",
  archived: "bg-amber-50 text-amber-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        STATUS_PILL[status] ?? STATUS_PILL.draft
      }`}
    >
      {status}
    </span>
  );
}

export function StoreAdmin({
  initialStore,
  initialProducts,
}: {
  initialStore: Store;
  initialProducts: EditableProduct[];
}) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [store] = useState<Store>(initialStore);
  const [products, setProducts] = useState<EditableProduct[]>(initialProducts);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function reload() {
    const r = await api
      .get<{ products: EditableProduct[] }>(endpoints.products.list)
      .then((x) => x.data.products)
      .catch(() => null);
    if (Array.isArray(r)) setProducts(r);
  }

  async function connect() {
    setConnecting(true);
    try {
      const { data } = await api.post<{ url: string }>(endpoints.store.connect, {});
      window.location.href = data.url;
    } catch (e) {
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      await alert({
        title: "Couldn't connect Stripe",
        message: d.error || "Please try again.",
      });
      setConnecting(false);
    }
  }

  function openNewProduct() {
    setEditing({
      id: "",
      handle: "",
      title: "New product",
      description: "",
      status: "draft",
      variants: [{ id: "", title: "Default", priceAmount: 0, currency: "", inventory: 0 }],
      images: [],
    });
  }

  async function deleteProduct(id: string) {
    const ok = await confirm({
      title: "Delete product?",
      message: "This product and all of its variants will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(endpoints.products.byId(id));
      setEditing(null);
      await reload();
    } catch (e) {
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      await alert({ title: "Couldn't delete product", message: d.error || "Please try again." });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Store</h1>
        <Button variant="neutral" onPress={openNewProduct} leadingIcon={<Plus size={15} />}>
          New product
        </Button>
      </div>

      <div className="mb-8 rounded-xl border border-border p-4">
        <div className="text-sm font-semibold text-fg">Stripe</div>
        {store?.chargesEnabled ? (
          <div className="mt-1 text-sm font-medium text-green-600">Connected — charges enabled</div>
        ) : (
          <Button variant="secondary" className="mt-2" onPress={connect} isLoading={connecting}>
            {store?.stripeAccountId ? "Finish Stripe onboarding" : "Connect Stripe"}
          </Button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          No products yet.
        </p>
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH>Status</TH>
                <TH>Price</TH>
                <TH>Inventory</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {products.map((p) => {
                const v = p.variants[0];
                return (
                  <TR key={p.id} className="group">
                    <TD
                      className="max-w-[260px] truncate font-medium text-zinc-900"
                      title={p.title}
                    >
                      {p.title}
                    </TD>
                    <TD>
                      <StatusPill status={p.status} />
                    </TD>
                    <TD className="tabular-nums">
                      {v ? (
                        formatMoney(v.priceAmount, v.currency)
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </TD>
                    <TD className="tabular-nums">
                      {v ? v.inventory : <span className="text-zinc-300">—</span>}
                    </TD>
                    <TD className="w-px whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => setEditing(p)}
                          className="text-brand-600 hover:bg-brand-50"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete product"
                          onPress={() => deleteProduct(p.id)}
                          className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      <ProductEditor
        product={editing}
        onSaved={(updated) => {
          setProducts((list) => {
            const exists = list.some((p) => p.id === updated.id);
            return exists
              ? list.map((p) => (p.id === updated.id ? updated : p))
              : [updated, ...list];
          });
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onDelete={deleteProduct}
      />
    </div>
  );
}
