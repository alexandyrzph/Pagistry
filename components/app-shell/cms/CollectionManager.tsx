"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import {
  Field,
  TextInput,
  TextArea,
  NumberInput,
  SelectInput,
  ImageInput,
  Toggle,
  inputCls,
} from "@/components/editor/controls";
import { CMS_FIELD_TYPES, uniqueFieldKey, blankItemData } from "@/lib/cms/cms";
import type {
  CollectionData,
  CollectionField,
  CollectionItem,
  CmsFieldType,
} from "@/lib/types";

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: CollectionField;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (field.type) {
    case "textarea":
      return <TextArea value={value ?? ""} onChange={onChange} />;
    case "number":
      // NumberInput.onChange always emits number (empty input → 0); coerce at call site
      return (
        <NumberInput
          value={value ?? ""}
          onChange={(v: number) => onChange(v)}
        />
      );
    case "boolean":
      return <Toggle value={!!value} onChange={onChange} />;
    case "image":
      return <ImageInput value={value ?? ""} onChange={onChange} />;
    case "date":
      return (
        <input
          type="date"
          className={inputCls}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return <TextInput value={value ?? ""} onChange={onChange} />;
  }
}

export function CollectionManager({ initial }: { initial: CollectionData }) {
  const router = useRouter();
  const [col, setCol] = useState<CollectionData>(initial);
  const [tab, setTab] = useState<"items" | "fields" | "settings">("items");
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchCollection(
    patch: Partial<Pick<CollectionData, "name" | "fields" | "detailEnabled">>
  ) {
    const next = { ...col, ...patch };
    setCol(next);
    await fetch(`/api/collections/${col.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  async function reloadItems() {
    const r = await fetch(`/api/collections/${col.id}/items`)
      .then((x) => x.json())
      .catch(() => null);
    if (Array.isArray(r)) setCol((c) => ({ ...c, items: r }));
  }

  async function addItem() {
    setBusy(true);
    try {
      await fetch(`/api/collections/${col.id}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: blankItemData(col.fields) }),
      });
      await reloadItems();
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(item: CollectionItem) {
    await fetch(`/api/collections/${col.id}/items/${item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: item.data }),
    });
    await reloadItems();
    setEditing(null);
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/collections/${col.id}/items/${id}`, { method: "DELETE" });
    await reloadItems();
  }

  async function addField(label: string) {
    const key = uniqueFieldKey(
      label,
      col.fields.map((f) => f.key)
    );
    await patchCollection({ fields: [...col.fields, { key, label, type: "text" }] });
  }

  async function deleteCollection() {
    if (!confirm(`Delete "${col.name}" and all its items?`)) return;
    const res = await fetch(`/api/collections/${col.id}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) {
      router.push("/cms");
      router.refresh();
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      alert(d.error || "Could not delete the collection.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/cms"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={15} /> CMS
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{col.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        /{col.slug} · {col.items.length} item{col.items.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {(["items", "fields", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "items" && (
          <div>
            <button
              onClick={addItem}
              disabled={busy}
              className="mb-4 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add
              item
            </button>
            {col.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                No items yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>
                      {col.fields.slice(0, 4).map((f) => (
                        <th key={f.key} className="px-4 py-2.5 font-medium">
                          {f.label}
                        </th>
                      ))}
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {col.items.map((it) => (
                      <tr key={it.id} className="hover:bg-zinc-50">
                        {col.fields.slice(0, 4).map((f) => (
                          <td
                            key={f.key}
                            className="max-w-[200px] truncate px-4 py-2.5 text-zinc-700"
                          >
                            {String(it.data?.[f.key] ?? "")}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setEditing(it)}
                            className="mr-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(it.id)}
                            aria-label="Delete item"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "fields" && (
          <div className="space-y-3">
            {col.fields.map((f, i) => (
              <div
                key={f.key}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 p-2.5"
              >
                <input
                  className={inputCls + " max-w-[200px]"}
                  value={f.label}
                  onChange={(e) => {
                    const fields = [...col.fields];
                    fields[i] = { ...f, label: e.target.value };
                    setCol({ ...col, fields });
                  }}
                  onBlur={() => patchCollection({ fields: col.fields })}
                />
                <div className="w-40">
                  <SelectInput
                    value={f.type}
                    onChange={(v: string) => {
                      const fields = [...col.fields];
                      fields[i] = { ...f, type: v as CmsFieldType };
                      patchCollection({ fields });
                    }}
                    options={CMS_FIELD_TYPES}
                  />
                </div>
                <code className="text-xs text-zinc-400">{f.key}</code>
                <button
                  onClick={() =>
                    patchCollection({ fields: col.fields.filter((x) => x.key !== f.key) })
                  }
                  aria-label={`Remove ${f.label}`}
                  className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <AddField onAdd={addField} />
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-sm space-y-5">
            <Field label="Collection name">
              <TextInput
                value={col.name}
                onChange={(v: string) => setCol({ ...col, name: v })}
              />
            </Field>
            <button
              onClick={() => patchCollection({ name: col.name })}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save name
            </button>
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <span className="text-sm text-zinc-700">Detail pages</span>
              <Toggle
                value={!!col.detailEnabled}
                onChange={(v: boolean) => patchCollection({ detailEnabled: v })}
              />
            </label>
            <Link
              href={`/collection/${col.id}/template`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Edit detail template <ExternalLink size={14} />
            </Link>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Delete collection</p>
              <button
                onClick={deleteCollection}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/40 p-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-bold text-zinc-900">Edit item</h3>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {col.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <FieldValueInput
                    field={f}
                    value={editing.data?.[f.key]}
                    onChange={(v) =>
                      setEditing({ ...editing, data: { ...editing.data, [f.key]: v } })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3.5 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={() => saveItem(editing)}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddField({ onAdd }: { onAdd: (label: string) => void }) {
  const [label, setLabel] = useState("");
  return (
    <div className="flex gap-2">
      <input
        className={inputCls + " max-w-[240px]"}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="New field label"
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) {
            onAdd(label.trim());
            setLabel("");
          }
        }}
      />
      <button
        onClick={() => {
          if (label.trim()) {
            onAdd(label.trim());
            setLabel("");
          }
        }}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <Plus size={15} /> Add field
      </button>
    </div>
  );
}
