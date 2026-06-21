"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { AssetPicker } from "@/components/editor/AssetPicker";

export type EditableProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  variants: { id: string; title: string; priceAmount: number; inventory: number }[];
  images: { url: string; alt: string }[];
};

export function ProductEditor({
  product,
  onClose,
}: {
  product: EditableProduct;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState(product.status);
  const [price, setPrice] = useState((product.variants[0]?.priceAmount ?? 0) / 100);
  const [inventory, setInventory] = useState(product.variants[0]?.inventory ?? 0);
  const [images, setImages] = useState(product.images);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api.patch(endpoints.products.byId(product.id), {
      title,
      description,
      status,
      variants: [{ id: product.variants[0]?.id, priceAmount: Math.round(price * 100), inventory }],
      images,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Edit product</h2>
        <label className="block text-sm font-medium">Title</label>
        <input
          className="mt-1 mb-3 w-full rounded-lg border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 mb-3 w-full rounded-lg border px-3 py-2"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Price</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Inventory</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={inventory}
              onChange={(e) => setInventory(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Status</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setPicking(true)}
          >
            Add image
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={im.url} alt={im.alt} className="h-16 w-16 rounded object-cover" />
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <AssetPicker
        open={picking}
        kind="image"
        onClose={() => setPicking(false)}
        onSelect={(url) => {
          setImages((im) => [...im, { url, alt: "" }]);
          setPicking(false);
        }}
      />
    </div>
  );
}
