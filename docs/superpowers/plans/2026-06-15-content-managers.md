# Content Managers Implementation Plan (Spec 1, Plan 1C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the **Design system**, **CMS collections**, and **Site** from editor-only panels into full standalone destinations in the app shell — so the Build/Brand nav items (`/design`, `/cms`, `/site`) become real managers, not hub stubs.

**Architecture:** New pages under the existing `app/(app)/` route group. They reuse the already-decoupled pieces — the `useDesignSystem` zustand store, the `/api/collections` + `/api/site` endpoints, the `lib/cms` + `lib/collection-service` + `lib/design-system` helpers, and the generic `components/editor/controls.tsx` inputs — without depending on editor/iframe context. The editor's own panels are left untouched (the editor keeps working as-is).

**Tech Stack:** Next.js 16 (App Router, route group, async params), React 19, Tailwind v4, zustand (existing `useDesignSystem`), lucide-react. No new dependencies.

---

## Important environment notes

- **Not a git repo** — each task ends with a "Checkpoint" (save point). **Never touch ``.**
- **Verification is runtime** (UI): gate each task on `npx tsc --noEmit` + driving the running app (dev server on **:3000**, already up). No vitest UI tests. `notFound()` returns 200 in `next dev` (404 in prod) — assert on content, not status.
- **Reusable building blocks (confirmed to exist):**
  - `store/design-system.ts` → `useDesignSystem` (state `colors: ColorToken[]`, `textStyles: TextStyle[]`, `loaded`; actions `load()`, `addColor(value?)`, `updateColor(id, patch)`, `removeColor(id)`, `addTextStyle(name, props?)`, `updateTextStyle(id, patch)`, `updateTextStyleProp(id, key, value)`, `removeTextStyle(id)`; debounced PUT `/api/site`).
  - `components/editor/controls.tsx` → `inputCls`, `Field({label,children})`, `TextInput`, `TextArea`, `NumberInput`, `SelectInput({value,onChange,options})`, `ColorInput({value,onChange,hideTokens?})`, `UnitInput`, `ImageInput`, `Toggle`, `Segmented`.
  - `lib/cms.ts` → `CMS_FIELD_TYPES: {value: CmsFieldType, label}[]`, `uniqueFieldKey(label, existingKeys[])`, `blankItemData(fields)`, `blankValue(type)`, `slugify`.
  - `lib/collection-service.ts` → `serializeCollection`, `parseFields`, `parseItemData`.
  - Types in `lib/types.ts`: `ColorToken {id,name,value}`, `TextStyle {id,name,props: StyleProps}`, `StyleProps` (camelCase CSS props incl. `fontSize,fontWeight,lineHeight,letterSpacing,color,textAlign,textTransform`), `CmsFieldType = "text"|"textarea"|"image"|"url"|"number"|"date"|"boolean"`, `CollectionField {key,label,type}`, `CollectionItem {id,data,order}`, `CollectionData {id,name,slug,fields,items,detailEnabled}`.
  - Collection APIs (workspace-scoped, role-gated — from Plan 1A): `GET/POST /api/collections`, `GET/PUT/DELETE /api/collections/[id]` (PUT body `{name?,fields?,detailEnabled?,detailTemplate?}`), `GET/POST /api/collections/[id]/items` (POST `{data}`), `PUT/DELETE /api/collections/[id]/items/[itemId]` (PUT `{data?,order?}`).
- **Role note:** these pages live in `(app)` (any member can view). Mutations go through editor+-gated APIs, so a VIEWER's saves return 403 (harmless; the store/handlers swallow or surface it). No extra page-level gating required for 1C.

---

## File structure

New:
- `components/app-shell/design/DesignManager.tsx` — standalone design-system manager (client).
- `components/app-shell/cms/CollectionManager.tsx` — standalone collection manager (client).
- `components/app-shell/cms/NewCollectionButton.tsx` — create-collection action (client).
- `app/(app)/cms/[id]/page.tsx` — collection manager route (server wrapper).

Modified (replace the Plan 1B hub bodies):
- `app/(app)/design/page.tsx` — render `<DesignManager />`.
- `app/(app)/cms/page.tsx` — rows link to `/cms/[id]`; add `<NewCollectionButton />`.
- `app/(app)/site/page.tsx` — enrich the hub with header/footer block counts + last-updated.

---

## Task 1: Design system manager

**Files:**
- Create: `components/app-shell/design/DesignManager.tsx`
- Modify: `app/(app)/design/page.tsx`

- [ ] **Step 1: `components/app-shell/design/DesignManager.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDesignSystem } from "@/store/design-system";
import { Field, TextInput, ColorInput, UnitInput, SelectInput, inputCls } from "@/components/editor/controls";
import type { StyleProps } from "@/lib/types";

const WEIGHTS = ["300", "400", "500", "600", "700", "800"].map((w) => ({ value: w, label: w }));
const ALIGN = ["left", "center", "right"].map((a) => ({ value: a, label: a }));
const TRANSFORM = [
  { value: "none", label: "none" }, { value: "uppercase", label: "UPPER" },
  { value: "capitalize", label: "Title" }, { value: "lowercase", label: "lower" },
];

export function DesignManager() {
  const ds = useDesignSystem();
  useEffect(() => { if (!ds.loaded) ds.load(); }, [ds]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Design system</h1>
      <p className="mt-1 text-sm text-zinc-500">Shared colors and text styles. Changes apply across every page in this workspace.</p>

      {/* Colors */}
      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Color styles</h2>
          <button onClick={() => ds.addColor()} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"><Plus size={14} /> Add color</button>
        </div>
        {ds.colors.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">No color styles yet. Add one to reuse it everywhere.</p>
        ) : (
          <div className="space-y-2">
            {ds.colors.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-2.5">
                <div className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200" style={{ background: c.value }} />
                <input className={inputCls + " max-w-[180px]"} value={c.name} onChange={(e) => ds.updateColor(c.id, { name: e.target.value })} placeholder="Name" />
                <div className="w-40"><ColorInput value={c.value} onChange={(v) => ds.updateColor(c.id, { value: v })} hideTokens /></div>
                <button onClick={() => ds.removeColor(c.id)} aria-label={`Remove ${c.name}`} className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Text styles */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Text styles</h2>
          <button onClick={() => ds.addTextStyle("New style")} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"><Plus size={14} /> Add style</button>
        </div>
        {ds.textStyles.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">No text styles yet. Define headings, body, captions once and reuse them.</p>
        ) : (
          <div className="space-y-4">
            {ds.textStyles.map((t) => {
              const p = t.props as StyleProps;
              const set = (k: keyof StyleProps, v: string) => ds.updateTextStyleProp(t.id, k as string, v);
              return (
                <div key={t.id} className="rounded-xl border border-zinc-100 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <input className={inputCls + " max-w-[220px] font-medium"} value={t.name} onChange={(e) => ds.updateTextStyle(t.id, { name: e.target.value })} />
                    <button onClick={() => ds.removeTextStyle(t.id)} aria-label={`Remove ${t.name}`} className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                  <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2.5" style={{ color: p.color, fontSize: p.fontSize, fontWeight: p.fontWeight as any, lineHeight: p.lineHeight, letterSpacing: p.letterSpacing, textAlign: p.textAlign as any, textTransform: p.textTransform as any }}>
                    The quick brown fox
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Size"><UnitInput value={p.fontSize || ""} onChange={(v: string) => set("fontSize", v)} units={["px", "rem", "em"]} placeholder="16px" /></Field>
                    <Field label="Weight"><SelectInput value={String(p.fontWeight || "400")} onChange={(v: string) => set("fontWeight", v)} options={WEIGHTS} /></Field>
                    <Field label="Line height"><UnitInput value={p.lineHeight || ""} onChange={(v: string) => set("lineHeight", v)} units={["", "px", "em"]} placeholder="1.4" /></Field>
                    <Field label="Letter spacing"><UnitInput value={p.letterSpacing || ""} onChange={(v: string) => set("letterSpacing", v)} units={["px", "em"]} placeholder="0" /></Field>
                    <Field label="Align"><SelectInput value={p.textAlign || "left"} onChange={(v: string) => set("textAlign", v)} options={ALIGN} /></Field>
                    <Field label="Transform"><SelectInput value={p.textTransform || "none"} onChange={(v: string) => set("textTransform", v)} options={TRANSFORM} /></Field>
                    <Field label="Color"><ColorInput value={p.color || ""} onChange={(v: string) => set("color", v)} /></Field>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
```

If any `controls.tsx` prop signature differs from the above (e.g. `UnitInput`'s `units`/`onChange`, or `SelectInput`'s `options`), open `components/editor/controls.tsx` and adapt the call sites to the real signatures — do NOT change `controls.tsx`. If `updateTextStyleProp`'s third arg is typed strictly, cast the key as shown.

- [ ] **Step 2: Replace `app/(app)/design/page.tsx`**

```tsx
import { requireWorkspace } from "@/lib/workspace";
import { DesignManager } from "@/components/app-shell/design/DesignManager";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  await requireWorkspace();
  return <DesignManager />;
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` clean. Runtime: open `/design`, add a color (it appears + the swatch updates), reload → it persists (proves the store's debounced PUT `/api/site` worked under the active workspace). Add a text style, tweak size/weight → the live preview updates. Switch workspace → `/design` shows that workspace's own tokens (scoping).

- [ ] **Step 4: Checkpoint.**

---

## Task 2: CMS collection manager

**Files:**
- Create: `app/(app)/cms/[id]/page.tsx`
- Create: `components/app-shell/cms/CollectionManager.tsx`

- [ ] **Step 1: `app/(app)/cms/[id]/page.tsx`** (server — scoped fetch, 404 if not in workspace)

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { serializeCollection } from "@/lib/collection-service";
import { CollectionManager } from "@/components/app-shell/cms/CollectionManager";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const row = await prisma.collection.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!row) notFound();
  return <CollectionManager initial={serializeCollection(row)} />;
}
```

- [ ] **Step 2: `components/app-shell/cms/CollectionManager.tsx`** (client — Items / Fields / Settings)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Field, TextInput, TextArea, NumberInput, SelectInput, ImageInput, Toggle, inputCls } from "@/components/editor/controls";
import { CMS_FIELD_TYPES, uniqueFieldKey, blankItemData } from "@/lib/cms";
import type { CollectionData, CollectionField, CollectionItem, CmsFieldType } from "@/lib/types";

function FieldValueInput({ field, value, onChange }: { field: CollectionField; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case "textarea": return <TextArea value={value ?? ""} onChange={onChange} />;
    case "number": return <NumberInput value={value ?? ""} onChange={(v: any) => onChange(v === "" ? "" : Number(v))} />;
    case "boolean": return <Toggle value={!!value} onChange={onChange} />;
    case "image": return <ImageInput value={value ?? ""} onChange={onChange} />;
    case "date": return <input type="date" className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    default: return <TextInput value={value ?? ""} onChange={onChange} />;
  }
}

export function CollectionManager({ initial }: { initial: CollectionData }) {
  const router = useRouter();
  const [col, setCol] = useState<CollectionData>(initial);
  const [tab, setTab] = useState<"items" | "fields" | "settings">("items");
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchCollection(patch: Partial<Pick<CollectionData, "name" | "fields" | "detailEnabled">>) {
    const next = { ...col, ...patch };
    setCol(next);
    await fetch(`/api/collections/${col.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
  }
  async function reloadItems() {
    const r = await fetch(`/api/collections/${col.id}/items`).then((x) => x.json()).catch(() => null);
    if (Array.isArray(r)) setCol((c) => ({ ...c, items: r }));
  }
  async function addItem() {
    setBusy(true);
    await fetch(`/api/collections/${col.id}/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: blankItemData(col.fields) }) });
    await reloadItems(); setBusy(false);
  }
  async function saveItem(item: CollectionItem) {
    await fetch(`/api/collections/${col.id}/items/${item.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: item.data }) });
    await reloadItems(); setEditing(null);
  }
  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/collections/${col.id}/items/${id}`, { method: "DELETE" });
    await reloadItems();
  }
  async function addField(label: string) {
    const key = uniqueFieldKey(label, col.fields.map((f) => f.key));
    await patchCollection({ fields: [...col.fields, { key, label, type: "text" }] });
  }
  async function deleteCollection() {
    if (!confirm(`Delete "${col.name}" and all its items?`)) return;
    await fetch(`/api/collections/${col.id}`, { method: "DELETE" });
    router.push("/cms"); router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/cms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"><ArrowLeft size={15} /> CMS</Link>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{col.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">/{col.slug} · {col.items.length} item{col.items.length !== 1 ? "s" : ""}</p>

      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {(["items", "fields", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-indigo-600 text-indigo-700" : "text-zinc-500 hover:text-zinc-800"}`}>{t}</button>
        ))}
      </div>

      <div className="py-6">
        {tab === "items" && (
          <div>
            <button onClick={addItem} disabled={busy} className="mb-4 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add item</button>
            {col.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">No items yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>{col.fields.slice(0, 4).map((f) => <th key={f.key} className="px-4 py-2.5 font-medium">{f.label}</th>)}<th className="w-20" /></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {col.items.map((it) => (
                      <tr key={it.id} className="hover:bg-zinc-50">
                        {col.fields.slice(0, 4).map((f) => <td key={f.key} className="max-w-[200px] truncate px-4 py-2.5 text-zinc-700">{String(it.data?.[f.key] ?? "")}</td>)}
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => setEditing(it)} className="mr-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Edit</button>
                          <button onClick={() => deleteItem(it.id)} aria-label="Delete item" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
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
              <div key={f.key} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-2.5">
                <input className={inputCls + " max-w-[200px]"} value={f.label} onChange={(e) => { const fields = [...col.fields]; fields[i] = { ...f, label: e.target.value }; setCol({ ...col, fields }); }} onBlur={() => patchCollection({ fields: col.fields })} />
                <div className="w-40"><SelectInput value={f.type} onChange={(v: string) => { const fields = [...col.fields]; fields[i] = { ...f, type: v as CmsFieldType }; patchCollection({ fields }); }} options={CMS_FIELD_TYPES} /></div>
                <code className="text-xs text-zinc-400">{f.key}</code>
                <button onClick={() => patchCollection({ fields: col.fields.filter((x) => x.key !== f.key) })} aria-label={`Remove ${f.label}`} className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            ))}
            <AddField onAdd={addField} />
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-sm space-y-5">
            <Field label="Collection name"><TextInput value={col.name} onChange={(v: string) => setCol({ ...col, name: v })} /></Field>
            <button onClick={() => patchCollection({ name: col.name })} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Save name</button>
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <span className="text-sm text-zinc-700">Detail pages</span>
              <Toggle value={!!col.detailEnabled} onChange={(v: boolean) => patchCollection({ detailEnabled: v })} />
            </label>
            <Link href={`/collection/${col.id}/template`} className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">Edit detail template <ExternalLink size={14} /></Link>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Delete collection</p>
              <button onClick={deleteCollection} className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"><Trash2 size={15} /> Delete</button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/40 p-4 pt-[8vh] backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-bold text-zinc-900">Edit item</h3>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {col.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <FieldValueInput field={f} value={editing.data?.[f.key]} onChange={(v) => setEditing({ ...editing, data: { ...editing.data, [f.key]: v } })} />
                </Field>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg px-3.5 py-2 text-sm text-zinc-500 hover:bg-zinc-100">Cancel</button>
              <button onClick={() => saveItem(editing)} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Save</button>
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
      <input className={inputCls + " max-w-[240px]"} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New field label" onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) { onAdd(label.trim()); setLabel(""); } }} />
      <button onClick={() => { if (label.trim()) { onAdd(label.trim()); setLabel(""); } }} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"><Plus size={15} /> Add field</button>
    </div>
  );
}
```

Adapt any control prop mismatch to the real `controls.tsx` signatures (do not edit `controls.tsx`). If `NumberInput`/`Toggle`/`ImageInput` `onChange` types differ, coerce at the call site.

- [ ] **Step 3: Verify** `npx tsc --noEmit` clean. Runtime: from `/cms`, open a collection → `/cms/[id]`; **Fields** tab add/rename/retype/remove a field; **Items** tab add an item, edit it in the modal (each field renders the right input by type), delete it; **Settings** rename, toggle detail, open the template editor link, and delete (returns to `/cms`). Open a `/cms/[id]` for an id from another workspace → not-found (no data leak).

- [ ] **Step 4: Checkpoint.**

---

## Task 3: CMS hub wiring + Site hub enrichment

**Files:**
- Create: `components/app-shell/cms/NewCollectionButton.tsx`
- Modify: `app/(app)/cms/page.tsx`
- Modify: `app/(app)/site/page.tsx`

- [ ] **Step 1: `components/app-shell/cms/NewCollectionButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NewCollectionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const res = await fetch("/api/collections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "New collection" }) });
    const c = await res.json().catch(() => ({}));
    if (res.ok && c?.id) { router.push(`/cms/${c.id}`); router.refresh(); }
    else setBusy(false);
  }
  return (
    <button onClick={create} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New collection
    </button>
  );
}
```

- [ ] **Step 2: Update `app/(app)/cms/page.tsx`** — (a) add a header row with the heading + `<NewCollectionButton />` (right side); (b) change each collection row `href` from `/collection/${col.id}/template` to **`/cms/${col.id}`**; (c) update the empty-state CTA to render `<NewCollectionButton />` instead of the "Open editor" link. Keep the `_count.items` count display from Plan 1B. Import `NewCollectionButton` from `@/components/app-shell/cms/NewCollectionButton`.

- [ ] **Step 3: Enrich `app/(app)/site/page.tsx`** — keep the two Header/Footer cards linking to `/site/header` and `/site/footer`, but load the Site row server-side (`prisma.site.findUnique({ where: { workspaceId: workspace.id } })`, guard null) and show each region's block count (`parseContent(site?.header).length`) and the site's `updatedAt` (relative or date). Use `requireWorkspace()` + `parseContent` from `@/lib/page-service`. Each card: region name, "N blocks", and an "Edit" button → the region editor.

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean. Runtime: `/cms` "New collection" creates one and lands on `/cms/[id]`; existing rows open the manager; the empty state can create. `/site` shows header/footer block counts and the Edit buttons open the region editors.

- [ ] **Step 5: Checkpoint.**

---

## Task 4: Final verification sweep

- [ ] **Step 1:** `npx tsc --noEmit` clean; `npm test` still green (67 — no unit changes, just confirm no broken imports).

- [ ] **Step 2: Runtime sweep** (signed in, two workspaces for scoping):
  - `/design`: add/edit/remove a color + a text style; reload persists; live preview works; a second workspace shows its own tokens.
  - `/cms`: create a collection → manager; add fields of each type; add/edit/delete items via the typed modal; rename; toggle detail; delete returns to `/cms`.
  - Cross-workspace `/cms/<foreign-id>` → not-found (no leak).
  - `/site`: block counts render; Edit buttons open `/site/header` `/site/footer` (which still save via `/api/site`).
  - The **editor is unchanged** — open a page in `/editor/[id]`, confirm its Design/CMS/Site panels still work (we didn't touch them).
  - Screenshots: `/design`, a `/cms/[id]` items table, the item-edit modal.

- [ ] **Step 3: Checkpoint** — Plan 1C complete; Spec 1 fully delivered (shell + tenancy + all manager surfaces).

---

## Self-review (author check against the goal)

- **Design → standalone** → Task 1 (`DesignManager` reuses `useDesignSystem` + `controls`; `/design` page renders it; persists per-workspace via `/api/site`).
- **CMS → standalone** → Task 2 (`/cms/[id]` server page scoped + 404; `CollectionManager` does fields/items/settings CRUD via the collection APIs + `lib/cms` helpers + `controls`) and Task 3 (hub links to `/cms/[id]` + create).
- **Site → standalone** → Task 3 (hub enriched with counts; the region editors already provide standalone editing).
- **No editor regressions:** the editor's own panels/components are untouched; only NEW standalone pages + the 3 hub bodies change. Verified in Task 4.
- **Scoping/roles:** server pages use `requireWorkspace()` and scope by `workspace.id`; mutations go through the already-role-gated APIs; cross-workspace `/cms/[id]` 404s.
- **Deferred:** richer CMS (reordering drag, bulk actions, media library), design tokens beyond color/text (spacing/radius scales) — future polish, not needed to make these real destinations.

**Consistency:** control props are used per the documented `controls.tsx` signatures (adapt at call sites if they differ; never edit `controls.tsx`); collection API payloads match Plan 1A (`{name,fields,detailEnabled}`, item `{data}`); routes match the sidebar `nav.ts` (`/design`, `/cms`, `/site`) plus the new `/cms/[id]`.
