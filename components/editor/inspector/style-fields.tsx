"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Link2, X } from "lucide-react";
import { findBlockById } from "@/lib/blocks/tree";
import { cn } from "@/lib/utils";
import type { StyleGroup, StyleProps } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { ColorInput, Segmented, SelectInput, Slider, TextInput, UnitInput } from "../controls";
import { STYLE_GROUP_SCHEMAS, type StyleFieldDef } from "@/lib/style-groups";

// --- style field hook -------------------------------------------------------

function useStyleField(k: keyof StyleProps) {
  const selectedId = useEditor((s) => s.selectedId);
  const viewport = useEditor((s) => s.viewport);
  const setStyle = useEditor((s) => s.setStyle);
  const value = useEditor((s) => {
    const b = s.selectedId ? findBlockById(s.tree, s.selectedId) : null;
    return ((b?.styles[s.viewport]?.[k] as string) ?? "") as string;
  });
  const set = (val: string) => {
    if (selectedId) setStyle(selectedId, viewport, k, val);
  };
  return [value, set] as const;
}

function useThemeSwatches() {
  const brand = useEditor((s) => s.theme.brand);
  return [brand || "#6366f1", "#0f172a", "#334155", "#64748b", "#cbd5e1", "#f1f5f9", "#ffffff"];
}

// Row wrapper: label + "overridden on this breakpoint" dot + reset.
function SRow({ label, value, onReset, children }: { label: string; value: string; onReset: () => void; children: React.ReactNode }) {
  const active = value !== "" && value != null;
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
          {label}
          {active && <span className="h-1 w-1 rounded-full bg-indigo-400" title="Set for this breakpoint" />}
        </span>
        {active && (
          <button type="button" onClick={onReset} title="Reset" className="text-zinc-300 transition-colors hover:text-zinc-500">
            <X size={11} />
          </button>
        )}
      </span>
      {children}
    </label>
  );
}

function SUnit({ label, k, units, placeholder }: { label: string; k: keyof StyleProps; units?: string[]; placeholder?: string }) {
  const [value, set] = useStyleField(k);
  return (
    <SRow label={label} value={value} onReset={() => set("")}>
      <UnitInput value={value} onChange={set} units={units} placeholder={placeholder} />
    </SRow>
  );
}

function SText({ label, k, placeholder }: { label: string; k: keyof StyleProps; placeholder?: string }) {
  const [value, set] = useStyleField(k);
  return (
    <SRow label={label} value={value} onReset={() => set("")}>
      <TextInput value={value} onChange={set} placeholder={placeholder} />
    </SRow>
  );
}

function SColor({ label, k }: { label: string; k: keyof StyleProps }) {
  const [value, set] = useStyleField(k);
  const swatches = useThemeSwatches();
  return (
    <SRow label={label} value={value} onReset={() => set("")}>
      <ColorInput value={value} onChange={set} swatches={swatches} />
    </SRow>
  );
}

function SSelect({ label, k, options }: { label: string; k: keyof StyleProps; options: { label: string; value: string }[] }) {
  const [value, set] = useStyleField(k);
  return (
    <SRow label={label} value={value} onReset={() => set("")}>
      <SelectInput value={value} onChange={set} options={options} />
    </SRow>
  );
}

function SSegment({ label, k, options }: { label: string; k: keyof StyleProps; options: { value: string; label: string; icon?: React.ReactNode }[] }) {
  const [value, set] = useStyleField(k);
  return (
    <SRow label={label} value={value} onReset={() => set("")}>
      <Segmented value={value} onChange={set} options={options} />
    </SRow>
  );
}

function SOpacity() {
  const [value, set] = useStyleField("opacity");
  return (
    <SRow label="Opacity" value={value} onReset={() => set("")}>
      <Slider value={value === "" ? "100%" : value} onChange={set} min={0} max={100} step={1} unit="%" />
    </SRow>
  );
}

function SpacingControl({ label, keys }: { label: string; keys: [keyof StyleProps, keyof StyleProps, keyof StyleProps, keyof StyleProps] }) {
  const t = useStyleField(keys[0]);
  const r = useStyleField(keys[1]);
  const bt = useStyleField(keys[2]);
  const l = useStyleField(keys[3]);
  const cells = [t, r, bt, l] as const;
  const allEqual = cells.every((c) => c[0] === cells[0][0]);
  const [linked, setLinked] = useState(true);
  const setAll = (v: string) => cells.forEach((c) => c[1](v));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500">{label}</span>
        <button
          type="button"
          onClick={() => setLinked((x) => !x)}
          title={linked ? "Edit each side" : "Link all sides"}
          className={cn("rounded p-0.5 transition-colors", linked ? "text-indigo-500" : "text-zinc-300 hover:text-zinc-500")}
        >
          <Link2 size={12} />
        </button>
      </div>
      {linked ? (
        <UnitInput value={allEqual ? cells[0][0] : ""} onChange={setAll} placeholder="0" />
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map((c, i) => (
            <div key={i}>
              <UnitInput value={c[0]} onChange={c[1]} placeholder="0" />
              <span className="mt-0.5 block text-center text-[9px] font-semibold text-zinc-400">{["T", "R", "B", "L"][i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- style groups -----------------------------------------------------------

function StyleControl({ field }: { field: StyleFieldDef }) {
  switch (field.control) {
    case "unit":
      return <SUnit label={field.label} k={field.k} units={field.units} placeholder={field.placeholder} />;
    case "text":
      return <SText label={field.label} k={field.k} placeholder={field.placeholder} />;
    case "color":
      return <SColor label={field.label} k={field.k} />;
    case "select":
      return <SSelect label={field.label} k={field.k} options={field.options} />;
    case "segment":
      return <SSegment label={field.label} k={field.k} options={field.options} />;
    case "spacing":
      return <SpacingControl label={field.label} keys={field.keys} />;
    case "opacity":
      return <SOpacity />;
  }
}

export function StyleGroupView({ group }: { group: StyleGroup }) {
  const schema = STYLE_GROUP_SCHEMAS[group];
  return (
    <Section title={schema.title} defaultOpen={schema.defaultOpen}>
      {schema.rows.map((row, i) =>
        row.length === 1 ? (
          <StyleControl key={i} field={row[0]} />
        ) : (
          <div key={i} className="grid grid-cols-2 gap-2">
            {row.map((f, j) => (
              <StyleControl key={j} field={f} />
            ))}
          </div>
        ),
      )}
    </Section>
  );
}

export function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600"
      >
        {title}
        <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
