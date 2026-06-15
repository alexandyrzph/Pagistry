"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ColorInput,
  Field,
  FileInput,
  IconPicker,
  ImageInput,
  NumberInput,
  SelectInput,
  StringList,
  TextArea,
  TextInput,
  Toggle,
  inputCls,
} from "@/components/editor/controls";
import type { SelectOption, SettingField } from "@/lib/types";

export type FieldInputProps = {
  value: any;
  onChange: (v: any) => void;
  options?: SelectOption[];
  placeholder?: string;
};

const textInput = ({ value, onChange, placeholder }: FieldInputProps) => (
  <TextInput value={value ?? ""} onChange={onChange} placeholder={placeholder} />
);

/**
 * Leaf (non-recursive) field renderers keyed by field-type string. Shared by the
 * inspector content fields, the items-editor sub-fields, and the CMS item editor.
 * The recursive "items" type is intentionally absent — its consumer renders
 * <ItemsEditor/> directly.
 */
export const LEAF_INPUTS: Record<string, (p: FieldInputProps) => ReactNode> = {
  text: textInput,
  url: textInput,
  textarea: ({ value, onChange, placeholder }) => (
    <TextArea value={value ?? ""} onChange={onChange} placeholder={placeholder} />
  ),
  code: ({ value, onChange, placeholder }) => (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={6}
      spellCheck={false}
      className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
    />
  ),
  number: ({ value, onChange, placeholder }) => (
    <NumberInput value={value ?? ""} onChange={onChange} placeholder={placeholder} />
  ),
  select: ({ value, onChange, options }) => (
    <SelectInput value={String(value ?? "")} onChange={onChange} options={options ?? []} />
  ),
  color: ({ value, onChange }) => <ColorInput value={value ?? ""} onChange={onChange} />,
  boolean: ({ value, onChange }) => <Toggle value={!!value} onChange={onChange} />,
  icon: ({ value, onChange }) => <IconPicker value={value ?? "Star"} onChange={onChange} />,
  image: ({ value, onChange }) => <ImageInput value={value ?? ""} onChange={onChange} />,
  file: ({ value, onChange }) => <FileInput value={value ?? ""} onChange={onChange} />,
  stringlist: ({ value, onChange }) => <StringList value={value ?? []} onChange={onChange} />,
  date: ({ value, onChange }) => (
    <input
      type="date"
      className={inputCls}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
};

/** Repeatable list of {key: value} items, each edited via its sub-field schema. */
export function ItemsEditor({
  value,
  itemFields,
  onChange,
}: {
  value: Record<string, any>[];
  itemFields: NonNullable<SettingField["itemFields"]>;
  onChange: (v: Record<string, any>[]) => void;
}) {
  const items = value ?? [];

  const blank = () => {
    const o: Record<string, any> = {};
    for (const f of itemFields) {
      o[f.key] = f.type === "boolean" ? false : f.type === "icon" ? "Star" : "";
    }
    return o;
  };

  const update = (i: number, key: string, v: any) => {
    const next = items.map((it, j) => (j === i ? { ...it, [key]: v } : it));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Item {i + 1}
            </span>
            <button
              type="button"
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="space-y-2">
            {itemFields.map((f) => (
              <Field key={f.key} label={f.label}>
                {(LEAF_INPUTS[f.type] ?? LEAF_INPUTS.text)({
                  value: item[f.key],
                  onChange: (v) => update(i, f.key, v),
                  options: f.options,
                })}
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus size={13} /> Add item
      </button>
    </div>
  );
}
