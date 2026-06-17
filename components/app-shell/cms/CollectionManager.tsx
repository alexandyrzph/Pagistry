"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
import { Table, TableContainer, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useConfirm, useAlert } from "@/components/ui/dialog-provider";
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
  const confirm = useConfirm();
  const alert = useAlert();
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
    const ok = await confirm({
      title: "Delete item?",
      message: "This item will be permanently removed from the collection.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: "Delete collection?",
      message: `"${col.name}" and all of its items will be permanently deleted.`,
      confirmLabel: "Delete collection",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/collections/${col.id}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) {
      router.push("/cms");
      router.refresh();
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      await alert({ title: "Couldn't delete collection", message: d.error || "Please try again." });
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

      <div className="mt-6 flex gap-1 border-b border-border">
        {(["items", "fields", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "items" && (
          <div>
            <Button variant="neutral" className="mb-4" onPress={addItem} isLoading={busy} leadingIcon={<Plus size={15} />}>Add item</Button>
            {col.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                No items yet.
              </p>
            ) : (
              <TableContainer>
                <Table>
                  <THead>
                    <tr>
                      {col.fields.slice(0, 4).map((f) => (
                        <TH key={f.key}>{f.label}</TH>
                      ))}
                      <TH className="text-right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    </tr>
                  </THead>
                  <TBody>
                    {col.items.map((it) => (
                      <TR key={it.id} className="group">
                        {col.fields.slice(0, 4).map((f, i) => (
                          <TD
                            key={f.key}
                            className={
                              i === 0
                                ? "max-w-[260px] truncate font-medium text-zinc-900"
                                : "max-w-[220px] truncate"
                            }
                            title={String(it.data?.[f.key] ?? "")}
                          >
                            {String(it.data?.[f.key] ?? "") || <span className="text-zinc-300">—</span>}
                          </TD>
                        ))}
                        <TD className="w-px whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="sm" onPress={() => setEditing(it)} className="text-brand-600 hover:bg-brand-50">Edit</Button>
                            <Button variant="ghost" size="icon" aria-label="Delete item" onPress={() => deleteItem(it.id)} className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
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
                <Button variant="ghost" size="icon" aria-label={`Remove ${f.label}`} onPress={() => patchCollection({ fields: col.fields.filter((x) => x.key !== f.key) })} className="ml-auto text-fg-subtle hover:bg-danger-50 hover:text-danger-500"><Trash2 size={15} /></Button>
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
            <Button variant="neutral" onPress={() => patchCollection({ name: col.name })}>Save name</Button>
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
              <Button variant="danger" className="mt-2" onPress={deleteCollection} leadingIcon={<Trash2 size={15} />}>Delete</Button>
            </div>
          </div>
        )}
      </div>

      <EditItemModal
        item={editing}
        fields={col.fields}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={saveItem}
      />
    </div>
  );
}

function EditItemModal({
  item,
  fields,
  onChange,
  onCancel,
  onSave,
}: {
  item: CollectionItem | null;
  fields: CollectionField[];
  onChange: (item: CollectionItem) => void;
  onCancel: () => void;
  onSave: (item: CollectionItem) => void;
}) {
  // Retain the last item so content stays visible through the exit animation.
  const lastRef = useRef<CollectionItem | null>(null);
  if (item) lastRef.current = item;
  const view = item ?? lastRef.current;

  return (
    <Modal open={!!item} onClose={onCancel} align="top" className="max-w-lg p-6">
      {view && (
        <>
          <h3 className="mb-4 text-sm font-bold text-zinc-900">Edit item</h3>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <FieldValueInput
                  field={f}
                  value={view.data?.[f.key]}
                  onChange={(v) => onChange({ ...view, data: { ...view.data, [f.key]: v } })}
                />
              </Field>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onPress={onCancel}>Cancel</Button>
            <Button variant="neutral" onPress={() => onSave(view)}>Save</Button>
          </div>
        </>
      )}
    </Modal>
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
      <Button variant="secondary" leadingIcon={<Plus size={15} />} onPress={() => { if (label.trim()) { onAdd(label.trim()); setLabel(""); } }}>Add field</Button>
    </div>
  );
}
