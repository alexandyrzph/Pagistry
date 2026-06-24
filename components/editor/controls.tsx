"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  Upload,
  Images,
  Loader2,
  FileUp,
  Paperclip,
  MoveHorizontal,
} from "lucide-react";
import { ICON_NAMES } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { DynamicIcon } from "@/components/blocks/shared";
import { useUpload } from "@/lib/hooks/use-upload";
import { AssetPicker } from "./AssetPicker";
import { useDesignSystem } from "@/store/design-system";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Slider as UISlider } from "@/components/ui/Slider";
import { ToggleButtonGroup, ToggleButton } from "@/components/ui/ToggleButtonGroup";
import type { SelectOption } from "@/lib/types";

const COLOR_VAR_RE = /^var\(--pc-color-([A-Za-z0-9]+)\)$/;

const inputCls =
  "w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-fg shadow-xs outline-none transition placeholder:text-fg-subtle hover:border-fg-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

/**
 * Carries the parent `Field` label down to the RAC-based controls
 * (Select/Switch/Slider/ToggleButtonGroup) which are button-based and so don't
 * inherit an accessible name from a wrapping `<label>`. The native inputs read
 * it too so they keep an accessible name now that `Field` is a `<div>`.
 */
const FieldLabelContext = createContext<string | undefined>(undefined);

export function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  // A plain <div>: the RAC controls render their own hidden native <select>/
  // <input>, and a wrapping <label> would mis-associate with those hidden
  // elements. The label text is exposed to children via context instead.
  return (
    <FieldLabelContext.Provider value={label}>
      <div className="block">
        {label && <span className="mb-1 block text-[11px] font-medium text-fg-muted">{label}</span>}
        {children}
      </div>
    </FieldLabelContext.Provider>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  const label = useContext(FieldLabelContext);
  return (
    <input
      type="text"
      aria-label={label}
      className={inputCls}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const label = useContext(FieldLabelContext);
  return (
    <textarea
      aria-label={label}
      className={cn(inputCls, "resize-y leading-relaxed")}
      rows={rows}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | string;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const label = useContext(FieldLabelContext);
  return (
    <input
      type="number"
      aria-label={label}
      className={inputCls}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  const label = useContext(FieldLabelContext);
  return (
    <Select
      aria-label={label ?? "Select"}
      items={options.map((o) => ({ id: o.value, label: o.label }))}
      selectedKey={value ?? ""}
      onSelectionChange={(k) => onChange(String(k))}
    />
  );
}

const RECENT_KEY = "pc-recent-colors";
function pushRecent(c: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const next = [c, ...list.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function ColorInput({
  value,
  onChange,
  swatches = [],
  hideTokens = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** theme/preset colors shown as quick-pick chips */
  swatches?: string[];
  /** hide the shared design-system color tokens (e.g. when defining a token) */
  hideTokens?: boolean;
}) {
  const tokens = useDesignSystem((s) => s.colors);
  const [recent, setRecent] = useState<string[]>(getRecent);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setRecent(getRecent());
  }

  // A value can be a literal hex or a `var(--pc-color-<id>)` token reference.
  const linkedId = String(value ?? "").match(COLOR_VAR_RE)?.[1];
  const linked = linkedId ? tokens.find((t) => t.id === linkedId) : undefined;
  const display = linked ? linked.value : value;
  const safe = /^#[0-9a-fA-F]{6}$/.test(display) ? display : "#6366f1";
  const chips = [...new Set([...swatches, ...recent])].filter(Boolean).slice(0, 10);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className="relative h-8 w-9 shrink-0 overflow-hidden rounded-md border border-zinc-200"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
          }}
        >
          <span
            className="absolute inset-0"
            style={{ backgroundColor: display || "transparent" }}
          />
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => pushRecent(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
        {linked ? (
          <span className={cn(inputCls, "flex items-center justify-between gap-2")}>
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: linked.value }}
              />
              <span className="truncate text-[13px] font-medium text-zinc-700">{linked.name}</span>
            </span>
            <button
              type="button"
              title="Unlink color style"
              onClick={() => onChange(linked.value)}
              className="shrink-0 text-zinc-300 transition-colors hover:text-zinc-500"
            >
              <Trash2 size={12} />
            </button>
          </span>
        ) : (
          <input
            type="text"
            className={inputCls}
            value={value ?? ""}
            placeholder="#000000"
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                onChange(c);
                pushRecent(c);
              }}
              className={cn(
                "h-5 w-5 rounded-md border shadow-xs transition-transform hover:scale-110",
                value?.toLowerCase() === c.toLowerCase()
                  ? "border-indigo-500 ring-1 ring-indigo-300"
                  : "border-zinc-200",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
      {!hideTokens && tokens.length > 0 && (
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Color styles
          </span>
          <div className="flex flex-wrap gap-1">
            {tokens.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                onClick={() => onChange(`var(--pc-color-${t.id})`)}
                className={cn(
                  "h-5 w-5 rounded-md border shadow-xs transition-transform hover:scale-110",
                  linked?.id === t.id
                    ? "border-indigo-500 ring-1 ring-indigo-300"
                    : "border-zinc-200",
                )}
                style={{ backgroundColor: t.value }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Number + unit field with drag-to-scrub on the grip. */
function parseUnit(value: string, fallback: string) {
  const v = String(value ?? "").trim();
  if (v === "") return { num: "", unit: fallback };
  if (v === "auto") return { num: "", unit: "auto" };
  const m = v.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
  return m ? { num: m[1], unit: m[2] || fallback } : { num: "", unit: fallback };
}

export function UnitInput({
  value,
  onChange,
  units = ["px", "%", "rem", "auto"],
  placeholder = "auto",
}: {
  value: string;
  onChange: (v: string) => void;
  units?: string[];
  placeholder?: string;
}) {
  const fallback = units.find((u) => u !== "auto") || "px";
  const { num, unit } = parseUnit(value, fallback);
  const emit = (n: string, u: string) =>
    onChange(u === "auto" ? "auto" : n === "" ? "" : `${n}${u}`);

  const scrub = (e: React.PointerEvent) => {
    const u = unit === "auto" ? fallback : unit;
    const startX = e.clientX;
    const startV = parseFloat(num) || 0;
    const onMove = (ev: PointerEvent) =>
      emit(String(Math.round(startV + (ev.clientX - startX))), u);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  };

  return (
    <div className="flex items-center rounded-lg border border-zinc-300 bg-white shadow-xs transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
      <button
        type="button"
        onPointerDown={scrub}
        title="Drag to adjust"
        className="flex cursor-ew-resize items-center px-1.5 text-zinc-300 hover:text-zinc-500"
      >
        <MoveHorizontal size={12} />
      </button>
      <input
        type="number"
        value={num}
        placeholder={placeholder}
        disabled={unit === "auto"}
        onChange={(e) => emit(e.target.value, unit === "auto" ? fallback : unit)}
        className="w-full min-w-0 bg-transparent py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:text-zinc-300"
      />
      <select
        value={unit}
        onChange={(e) => emit(num || "0", e.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-1.5 pl-1 pr-2 text-xs text-zinc-500 outline-none"
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Range slider with a numeric readout. */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "px",
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const label = useContext(FieldLabelContext);
  const num = parseFloat(String(value ?? "")) || 0;
  return (
    <div className="flex items-center gap-2.5">
      <UISlider
        aria-label={label ?? "Value"}
        className="flex-1"
        value={num}
        minValue={min}
        maxValue={max}
        step={step}
        onChange={(v) => onChange(`${v}${unit}`)}
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-muted">
        {num}
        {unit}
      </span>
    </div>
  );
}

/** Segmented icon/text control (e.g. text alignment). */
export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  const label = useContext(FieldLabelContext);
  return (
    <ToggleButtonGroup
      aria-label={label ?? "Options"}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const k = [...keys][0];
        if (k != null) onChange(String(k));
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} id={o.value} aria-label={o.label}>
          {o.icon ?? <span className="text-xs font-medium">{o.label}</span>}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const label = useContext(FieldLabelContext);
  return <Switch aria-label={label ?? "Toggle"} isSelected={value} onChange={onChange} />;
}

export function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [picker, setPicker] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploading, upload } = useUpload(onChange);
  useEffect(() => {
    const img = ref.current;
    if (img) setLoaded(img.complete);
    else setLoaded(false);
  }, [value]);

  return (
    <div className="space-y-2">
      <TextInput value={value} onChange={onChange} placeholder="https://… or upload" />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 shadow-xs transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
        </button>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 shadow-xs transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <Images size={13} /> Library
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {value && (
        <div className="relative h-20 w-full overflow-hidden rounded-md border border-zinc-200">
          {!loaded && <span className="pc-skeleton absolute inset-0" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={ref}
            src={value}
            alt="preview"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}
      <AssetPicker
        open={picker}
        kind="image"
        onSelect={onChange}
        onClose={() => setPicker(false)}
      />
    </div>
  );
}

export function FileInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [picker, setPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploading, upload } = useUpload(onChange);

  const name = value ? value.split("/").pop() : "";

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600">
          <Paperclip size={13} className="shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 shadow-xs transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} Upload
          file
        </button>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-xs transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <Images size={13} />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <AssetPicker open={picker} kind="all" onSelect={onChange} onClose={() => setPicker(false)} />
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(inputCls, "flex items-center justify-between")}
      >
        <span className="flex items-center gap-2">
          <DynamicIcon name={value} size={16} />
          <span className="text-zinc-600">{value}</span>
        </span>
        <ChevronDown size={14} className="text-zinc-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 grid max-h-56 w-full grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
            {ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-center rounded-md p-1.5 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600",
                  value === name && "bg-indigo-100 text-indigo-600",
                )}
              >
                <DynamicIcon name={name} size={16} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StringList({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const items = value ?? [];
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <TextInput
            value={item}
            onChange={(v) => {
              const next = [...items];
              next[i] = v;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, "New item"])}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 py-1.5 text-xs font-medium text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus size={13} /> Add item
      </button>
    </div>
  );
}

export { inputCls };
