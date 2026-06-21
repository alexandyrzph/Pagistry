"use client";

import { useState } from "react";
import axios from "axios";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { useAlert } from "@/components/ui/dialog-provider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  Field,
  TextInput,
  TextArea,
  NumberInput,
  SelectInput,
  ImageInput,
} from "@/components/editor/controls";

export type EditableProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  variants: {
    id: string;
    title: string;
    priceAmount: number;
    currency: string;
    inventory: number;
  }[];
  images: { url: string; alt: string }[];
};

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

export function ProductEditor({
  product,
  onSaved,
  onCancel,
  onDelete,
}: {
  product: EditableProduct | null;
  onSaved: (product: EditableProduct) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [last, setLast] = useState<EditableProduct | null>(product);
  if (product && product !== last) setLast(product);
  const view = product ?? last;

  return (
    <Modal open={!!product} onClose={onCancel} align="top" className="max-w-lg p-6">
      {view && (
        <Editor
          key={view.id}
          product={view}
          onSaved={onSaved}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      )}
    </Modal>
  );
}

function Editor({
  product,
  onSaved,
  onCancel,
  onDelete,
}: {
  product: EditableProduct;
  onSaved: (product: EditableProduct) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const alert = useAlert();
  const isNew = !product.id;
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState(product.status);
  const [price, setPrice] = useState((product.variants[0]?.priceAmount ?? 0) / 100);
  const [inventory, setInventory] = useState(product.variants[0]?.inventory ?? 0);
  const [images, setImages] = useState(product.images);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const priceAmount = Math.round(price * 100);
      const variantId = product.variants[0]?.id;
      const payload = {
        title,
        description,
        status,
        variants: [{ id: variantId, priceAmount, inventory }],
        images,
      };
      if (isNew) {
        const { data } = await api.post<{ product: EditableProduct }>(
          endpoints.products.list,
          payload,
        );
        onSaved(data.product);
      } else {
        const { data } = await api.patch<{ product: EditableProduct }>(
          endpoints.products.byId(product.id),
          payload,
        );
        onSaved(data.product);
      }
    } catch (e) {
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      await alert({
        title: isNew ? "Couldn't create product" : "Couldn't save product",
        message: d.error || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h3 className="mb-4 text-sm font-bold text-zinc-900">
        {isNew ? "New product" : "Edit product"}
      </h3>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        <Field label="Title">
          <TextInput value={title} onChange={setTitle} />
        </Field>
        <Field label="Description">
          <TextArea value={description} onChange={setDescription} rows={4} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price ($)">
            <NumberInput value={price} onChange={setPrice} />
          </Field>
          <Field label="Inventory">
            <NumberInput value={inventory} onChange={setInventory} />
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </Field>
        </div>
        <Field label="Images">
          <div className="space-y-2">
            {images.map((im, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <ImageInput
                    value={im.url}
                    onChange={(url) =>
                      setImages((list) => list.map((x, j) => (j === i ? { ...x, url } : x)))
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove image"
                  onPress={() => setImages((list) => list.filter((_, j) => j !== i))}
                  className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus size={14} />}
              onPress={() => setImages((list) => [...list, { url: "", alt: "" }])}
            >
              Add image
            </Button>
          </div>
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        {!isNew ? (
          <Button
            variant="danger"
            leadingIcon={<Trash2 size={15} />}
            onPress={() => onDelete(product.id)}
          >
            Delete product
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onPress={onCancel}>
            Cancel
          </Button>
          <Button variant="neutral" onPress={save} isLoading={saving} autoFocus>
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
