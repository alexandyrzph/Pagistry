"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/dialog-provider";
import { cn } from "@/lib/utils";
import type { CmsFieldType, CollectionField } from "@/lib/types";
import {
  blankItemData,
  CMS_FIELD_TYPES,
  uniqueFieldKey,
} from "@/lib/cms/cms";
import { useCollections } from "./collections-context";
import {
  SelectInput,
  Toggle,
  inputCls,
} from "./controls";
import { LEAF_INPUTS } from "@/lib/field-inputs";

type Editing = { id: string; data: Record<string, any> } | null;

export function CmsManagerModal({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { map, refresh } = useCollections();
  const collection = map[collectionId];
  const router = useRouter();
  const confirm = useConfirm();

  const [tab, setTab] = useState<"fields" | "items" | "detail">("fields");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CmsFieldType>("text");

  useEffect(() => {
    if (collection) setName(collection.name);
  }, [collection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collection vanished (deleted) — close.
  useEffect(() => {
    if (!collection) onClose();
  }, [collection, onClose]);

  if (!collection) return null;
  const fields = collection.fields;

  // --- persistence helpers --------------------------------------------------
  async function patchCollection(body: Record<string, any>) {
    setBusy(true);
    try {
      await fetch(`/api/collections/${collectionId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const saveFields = (next: CollectionField[]) => patchCollection({ fields: next });

  function addField() {
    const label = newLabel.trim() || "New field";
    const key = uniqueFieldKey(label, fields.map((f) => f.key));
    void saveFields([...fields, { key, label, type: newType }]);
    setNewLabel("");
    setNewType("text");
  }

  async function addItem() {
    setBusy(true);
    try {
      const r = await fetch(`/api/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: blankItemData(fields) }),
      });
      const item = await r.json();
      await refresh();
      setTab("items");
      setEditing({ id: item.id, data: item.data ?? {} });
    } finally {
      setBusy(false);
    }
  }

  async function saveItem() {
    if (!editing) return;
    setBusy(true);
    try {
      await fetch(`/api/collections/${collectionId}/items/${editing.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: editing.data }),
      });
      await refresh();
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(itemId: string) {
    setBusy(true);
    try {
      await fetch(`/api/collections/${collectionId}/items/${itemId}`, { method: "DELETE" });
      await refresh();
      if (editing?.id === itemId) setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCollection() {
    const ok = await confirm({
      title: "Delete collection?",
      message: `"${collection.name}" and all of its items will be permanently deleted.`,
      confirmLabel: "Delete collection",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    await refresh();
    onClose();
  }

  return (
    <Modal onClose={onClose} className="flex max-h-[86vh] max-w-2xl flex-col overflow-hidden">
          {/* header */}
          <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Database size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== collection.name && patchCollection({ name: name.trim() })}
                className="w-full truncate rounded-md px-1 py-0.5 text-sm font-bold tracking-tight text-zinc-900 outline-none transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="px-1 text-[11px] text-zinc-400">/{collection.slug}</span>
            </div>
            {busy && <Loader2 size={15} className="animate-spin text-zinc-300" />}
            <Button variant="ghost" size="icon" aria-label="Delete collection" onPress={deleteCollection} className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"><Trash2 size={15} /></Button>
            <Button variant="ghost" size="icon" aria-label="Close" onPress={onClose}><X size={16} /></Button>
          </div>

          {/* tabs */}
          <div className="flex shrink-0 gap-1 border-b border-zinc-200 px-3 py-2">
            {(["fields", "items", "detail"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  tab === t ? "bg-brand-50 text-brand-600" : "text-fg-muted hover:text-fg"
                )}
              >
                {t === "detail" ? "Detail page" : t}
                {t !== "detail" && (
                  <span className="ml-1.5 text-[10px] text-zinc-400">
                    {t === "fields" ? fields.length : collection.items.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === "fields" ? (
              <FieldsTab
                fields={fields}
                onSave={saveFields}
                newLabel={newLabel}
                setNewLabel={setNewLabel}
                newType={newType}
                setNewType={setNewType}
                onAdd={addField}
              />
            ) : tab === "items" ? (
              <ItemsTab
                fields={fields}
                items={collection.items}
                editing={editing}
                setEditing={setEditing}
                onAddItem={addItem}
                onSaveItem={saveItem}
                onDeleteItem={deleteItem}
                busy={busy}
              />
            ) : (
              <DetailTab
                slug={collection.slug}
                fields={fields}
                enabled={!!collection.detailEnabled}
                firstItemId={collection.items[0]?.id}
                onToggle={(v) => patchCollection({ detailEnabled: v })}
                onEdit={() => router.push(`/collection/${collectionId}/template`)}
              />
            )}
          </div>
    </Modal>
  );
}

// --- Fields tab -------------------------------------------------------------

function FieldsTab({
  fields,
  onSave,
  newLabel,
  setNewLabel,
  newType,
  setNewType,
  onAdd,
}: {
  fields: CollectionField[];
  onSave: (next: CollectionField[]) => void;
  newLabel: string;
  setNewLabel: (v: string) => void;
  newType: CmsFieldType;
  setNewType: (v: CmsFieldType) => void;
  onAdd: () => void;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const commitLabel = (key: string) => {
    const draft = labels[key];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    const field = fields.find((f) => f.key === key);
    if (field && trimmed && trimmed !== field.label) {
      onSave(fields.map((f) => (f.key === key ? { ...f, label: trimmed } : f)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2">
            <input
              value={labels[f.key] ?? f.label}
              onChange={(e) => setLabels((l) => ({ ...l, [f.key]: e.target.value }))}
              onBlur={() => commitLabel(f.key)}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-white px-2 py-1.5 text-sm text-zinc-800 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <code className="hidden shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">
              {f.key}
            </code>
            <div className="w-32 shrink-0">
              <SelectInput
                value={f.type}
                onChange={(v) => onSave(fields.map((x) => (x.key === f.key ? { ...x, type: v as CmsFieldType } : x)))}
                options={CMS_FIELD_TYPES}
              />
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove field" onPress={() => onSave(fields.filter((x) => x.key !== f.key))} className="shrink-0 text-fg-subtle hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></Button>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
            No fields yet. Add your first field below.
          </p>
        )}
      </div>

      {/* add field */}
      <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <label className="flex-1">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">New field</span>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="e.g. Cover image"
            className={inputCls}
          />
        </label>
        <div className="w-32">
          <span className="mb-1 block text-[11px] font-medium text-zinc-500">Type</span>
          <SelectInput value={newType} onChange={(v) => setNewType(v as CmsFieldType)} options={CMS_FIELD_TYPES} />
        </div>
        <Button variant="neutral" onPress={onAdd} leadingIcon={<Plus size={15} />}>Add</Button>
      </div>
    </div>
  );
}

// --- Items tab --------------------------------------------------------------

function ItemsTab({
  fields,
  items,
  editing,
  setEditing,
  onAddItem,
  onSaveItem,
  onDeleteItem,
  busy,
}: {
  fields: CollectionField[];
  items: { id: string; data: Record<string, any>; order: number }[];
  editing: Editing;
  setEditing: (e: Editing) => void;
  onAddItem: () => void;
  onSaveItem: () => void;
  onDeleteItem: (id: string) => void;
  busy: boolean;
}) {
  if (fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-400">
        Define some fields first, then come back to add items.
      </p>
    );
  }

  const summary = (data: Record<string, any>) => {
    const first = fields.find((f) => f.type === "text" || f.type === "textarea");
    const v = first ? data[first.key] : Object.values(data)[0];
    return (v && String(v)) || "Untitled item";
  };

  return (
    <div className="space-y-2">
      <button
        onClick={onAddItem}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 py-2.5 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
      >
        <Plus size={15} /> Add item
      </button>

      {items.length === 0 && (
        <p className="py-6 text-center text-xs text-zinc-400">No items yet.</p>
      )}

      {items.map((it) => {
        const isEditing = editing?.id === it.id;
        return (
          <div key={it.id} className="overflow-hidden rounded-lg border border-zinc-200">
            <div className="flex items-center gap-2 bg-zinc-50/60 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-700">
                {summary(it.data)}
              </span>
              {isEditing ? (
                <>
                  <Button variant="neutral" size="sm" onPress={onSaveItem} isDisabled={busy}>Save</Button>
                  <Button variant="ghost" size="sm" onPress={() => setEditing(null)}>Cancel</Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onPress={() => setEditing({ id: it.id, data: { ...it.data } })}>Edit</Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Delete item" onPress={() => onDeleteItem(it.id)} className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"><Trash2 size={14} /></Button>
            </div>

            {isEditing && editing && (
              <div className="space-y-3 border-t border-zinc-200 p-3">
                {fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-[11px] font-medium text-zinc-500">{f.label}</span>
                    <ItemFieldInput
                      field={f}
                      value={editing.data[f.key]}
                      onChange={(v) => setEditing({ ...editing, data: { ...editing.data, [f.key]: v } })}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemFieldInput({
  field,
  value,
  onChange,
}: {
  field: CollectionField;
  value: any;
  onChange: (v: any) => void;
}) {
  const render = LEAF_INPUTS[field.type] ?? LEAF_INPUTS.text;
  return <>{render({ value, onChange, placeholder: field.type === "url" ? "https://…" : undefined })}</>;
}

// --- Detail page tab --------------------------------------------------------

function DetailTab({
  slug,
  fields,
  enabled,
  firstItemId,
  onToggle,
  onEdit,
}: {
  slug: string;
  fields: CollectionField[];
  enabled: boolean;
  firstItemId?: string;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800">Detail pages</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Auto-generate a page for every item at{" "}
            <code className="rounded bg-zinc-200/70 px-1 text-[11px]">/c/{slug}/&lt;item&gt;</code>. Collection
            List cards link to it automatically.
          </p>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>

      {enabled && (
        <>
          <Button variant="neutral" className="w-full" onPress={onEdit} leadingIcon={<Pencil size={14} />}>Edit detail template</Button>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Insert item data with tokens
            </p>
            <p className="mb-2 text-xs leading-relaxed text-zinc-400">
              In the template, type these tokens into any text, heading, button or image — they're replaced with
              each item's values.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fields.length === 0 ? (
                <span className="text-xs text-zinc-400">Add fields first.</span>
              ) : (
                fields.map((f) => (
                  <code key={f.key} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-600">
                    {`{{${f.key}}}`}
                  </code>
                ))
              )}
            </div>
          </div>

          {firstItemId && (
            <a
              href={`/c/${slug}/${firstItemId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink size={12} /> Preview a detail page
            </a>
          )}
        </>
      )}
    </div>
  );
}
