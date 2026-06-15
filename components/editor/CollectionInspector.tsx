"use client";

import { Database } from "lucide-react";
import type { Block, CardBindings } from "@/lib/types";
import { CARD_SLOTS, defaultBindings } from "@/lib/cms";
import { useEditor } from "@/store/editor-store";
import { useCollections } from "./collections-context";
import { Field, NumberInput, SelectInput } from "./controls";

/**
 * Custom Content-tab inspector for the Collection List block. Its options are
 * data-driven: the collection picker lists existing collections, and the field
 * bindings are populated from the chosen collection's schema.
 */
export function CollectionInspector({ block }: { block: Block }) {
  const setProp = useEditor((s) => s.setProp);
  const { list, map } = useCollections();

  const collectionId = (block.props.collectionId as string) || "";
  const layout = (block.props.layout as string) || "grid";
  const columns = String(block.props.columns ?? "3");
  const limit = Number(block.props.limit ?? 0);
  const bindings = (block.props.bindings as CardBindings) || {};

  const collection = collectionId ? map[collectionId] : undefined;
  const fields = collection?.fields ?? [];

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
        <div className="rounded-lg bg-white p-2.5 text-zinc-400 shadow-sm">
          <Database size={18} />
        </div>
        <p className="text-sm font-semibold text-zinc-700">No collections yet</p>
        <p className="text-xs leading-relaxed text-zinc-400">
          Open the <span className="font-medium text-zinc-500">CMS</span> panel in the
          left rail to create a collection, then bind it here.
        </p>
      </div>
    );
  }

  const onPickCollection = (id: string) => {
    setProp(block.id, "collectionId", id);
    // seed sensible bindings so the list isn't blank on first bind
    const next = map[id];
    if (next) setProp(block.id, "bindings", defaultBindings(next.fields));
  };

  const setBinding = (slot: keyof CardBindings, value: string) => {
    setProp(block.id, "bindings", { ...bindings, [slot]: value });
  };

  const fieldOptions = [
    { label: "— None —", value: "" },
    ...fields.map((f) => ({ label: f.label, value: f.key })),
  ];

  return (
    <div className="space-y-5">
      <Field label="Collection">
        <SelectInput
          value={collectionId}
          onChange={onPickCollection}
          options={[
            { label: "Choose a collection…", value: "" },
            ...list.map((c) => ({ label: `${c.name} (${c.items.length})`, value: c.id })),
          ]}
        />
      </Field>

      {collection && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Layout">
              <SelectInput
                value={layout}
                onChange={(v) => setProp(block.id, "layout", v)}
                options={[
                  { label: "Grid", value: "grid" },
                  { label: "List", value: "list" },
                ]}
              />
            </Field>
            {layout === "grid" && (
              <Field label="Columns">
                <SelectInput
                  value={columns}
                  onChange={(v) => setProp(block.id, "columns", v)}
                  options={[
                    { label: "2", value: "2" },
                    { label: "3", value: "3" },
                    { label: "4", value: "4" },
                  ]}
                />
              </Field>
            )}
          </div>

          <Field label="Max items (0 = all)">
            <NumberInput
              value={limit}
              onChange={(v) => setProp(block.id, "limit", v)}
              placeholder="0"
            />
          </Field>

          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Field bindings
            </h4>
            {fields.length === 0 ? (
              <p className="text-[11px] leading-snug text-zinc-400">
                This collection has no fields yet. Add some in the CMS panel.
              </p>
            ) : (
              CARD_SLOTS.map((slot) => (
                <Field key={slot.key} label={`${slot.label} — ${slot.hint}`}>
                  <SelectInput
                    value={(bindings[slot.key] as string) || ""}
                    onChange={(v) => setBinding(slot.key, v)}
                    options={fieldOptions}
                  />
                </Field>
              ))
            )}
          </div>

          <p className="text-[11px] leading-snug text-zinc-400">
            Tip: manage items and fields from the{" "}
            <span className="font-medium text-zinc-500">CMS</span> panel.
          </p>
        </>
      )}
    </div>
  );
}
