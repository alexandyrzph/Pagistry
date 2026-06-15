"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Palette as PaletteIcon,
  Plus,
  Shuffle,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleProps, TextStyle } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useDesignSystem } from "@/store/design-system";
import { ColorInput, Field, Segmented, SelectInput, TextInput, UnitInput } from "./controls";

const FONT_OPTIONS = [
  { label: "Default (Geist)", value: "" },
  { label: "Modern Sans", value: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: "Elegant Serif", value: "ui-serif, Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { label: "Rounded", value: "'SF Pro Rounded', ui-rounded, 'Segoe UI', system-ui, sans-serif" },
];

const RADIUS_OPTIONS = [
  { label: "Default", value: "" },
  { label: "None", value: "0px" },
  { label: "Small", value: "8px" },
  { label: "Medium", value: "14px" },
  { label: "Large", value: "22px" },
  { label: "Pill", value: "9999px" },
];

const WEIGHTS = [
  { label: "Default", value: "" },
  { label: "Light", value: "300" },
  { label: "Normal", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Extra bold", value: "800" },
];
const TRANSFORMS = [
  { label: "Default", value: "" },
  { label: "none", value: "none" },
  { label: "uppercase", value: "uppercase" },
  { label: "capitalize", value: "capitalize" },
  { label: "lowercase", value: "lowercase" },
];
const ALIGN = [
  { value: "left", label: "Left", icon: <AlignLeft size={14} /> },
  { value: "center", label: "Center", icon: <AlignCenter size={14} /> },
  { value: "right", label: "Right", icon: <AlignRight size={14} /> },
];

const PRESETS = ["#6366f1", "#7c3aed", "#2563eb", "#0891b2", "#059669", "#e11d48", "#d97706", "#0f172a"];

function PanelSection({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-200/70 px-3 py-3 last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-700">
        <span className="flex items-center gap-1.5">{icon}{title}</span>
        <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="space-y-3 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorStyles() {
  const colors = useDesignSystem((s) => s.colors);
  const addColor = useDesignSystem((s) => s.addColor);
  const updateColor = useDesignSystem((s) => s.updateColor);
  const removeColor = useDesignSystem((s) => s.removeColor);
  return (
    <div className="space-y-3">
      {colors.length === 0 && (
        <p className="text-[11px] leading-snug text-zinc-400">
          Define reusable colors once. Pick them in any color field — editing a color style updates everywhere it&apos;s used.
        </p>
      )}
      {colors.map((c) => (
        <div key={c.id} className="rounded-lg border border-zinc-200 bg-white p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <input
              value={c.name}
              onChange={(e) => updateColor(c.id, { name: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-[13px] font-medium text-zinc-700 outline-none hover:border-zinc-200 focus:border-indigo-300"
            />
            <button onClick={() => removeColor(c.id)} title="Delete color style" className="shrink-0 rounded-md p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          </div>
          <ColorInput value={c.value} onChange={(v) => updateColor(c.id, { value: v })} hideTokens />
        </div>
      ))}
      <button onClick={() => addColor()} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-[12px] font-semibold text-zinc-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600">
        <Plus size={13} /> Add color style
      </button>
    </div>
  );
}

function tsField(ts: TextStyle, k: keyof StyleProps): string {
  return (ts.props[k] as string) ?? "";
}

function TextStyleRow({ ts }: { ts: TextStyle }) {
  const updateTextStyle = useDesignSystem((s) => s.updateTextStyle);
  const updateTextStyleProp = useDesignSystem((s) => s.updateTextStyleProp);
  const removeTextStyle = useDesignSystem((s) => s.removeTextStyle);
  const [open, setOpen] = useState(false);
  const set = (k: keyof StyleProps) => (v: string) => updateTextStyleProp(ts.id, k, v);
  const previewStyle: React.CSSProperties = {
    fontSize: ts.props.fontSize,
    fontWeight: ts.props.fontWeight as any,
    letterSpacing: ts.props.letterSpacing,
    textTransform: ts.props.textTransform as any,
    color: ts.props.color?.startsWith("var(") ? undefined : ts.props.color,
  };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center gap-1.5 p-2">
        <button onClick={() => setOpen((o) => !o)} title="Edit" className="shrink-0 text-zinc-400 hover:text-zinc-600">
          <ChevronDown size={14} className={cn("transition-transform", !open && "-rotate-90")} />
        </button>
        <input
          value={ts.name}
          onChange={(e) => updateTextStyle(ts.id, { name: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-[13px] font-medium text-zinc-700 outline-none hover:border-zinc-200 focus:border-indigo-300"
        />
        <span className="max-w-[70px] truncate text-zinc-400" style={previewStyle}>Ag</span>
        <button onClick={() => removeTextStyle(ts.id)} title="Delete text style" className="shrink-0 rounded-md p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="space-y-2.5 border-t border-zinc-100 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Font size"><UnitInput value={tsField(ts, "fontSize")} onChange={set("fontSize")} units={["px", "rem", "em"]} placeholder="16" /></Field>
                <Field label="Weight"><SelectInput value={tsField(ts, "fontWeight")} onChange={set("fontWeight")} options={WEIGHTS} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Line height"><UnitInput value={tsField(ts, "lineHeight")} onChange={set("lineHeight")} units={["", "px", "rem"]} placeholder="1.5" /></Field>
                <Field label="Letter spacing"><UnitInput value={tsField(ts, "letterSpacing")} onChange={set("letterSpacing")} units={["px", "em"]} placeholder="0" /></Field>
              </div>
              <Field label="Color"><ColorInput value={tsField(ts, "color")} onChange={set("color")} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Align"><Segmented value={tsField(ts, "textAlign")} onChange={set("textAlign")} options={ALIGN} /></Field>
                <Field label="Transform"><SelectInput value={tsField(ts, "textTransform")} onChange={set("textTransform")} options={TRANSFORMS} /></Field>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TextStyles() {
  const textStyles = useDesignSystem((s) => s.textStyles);
  const addTextStyle = useDesignSystem((s) => s.addTextStyle);
  return (
    <div className="space-y-2.5">
      {textStyles.length === 0 && (
        <p className="text-[11px] leading-snug text-zinc-400">
          Save typography presets (headings, body, captions). Apply them to any text block from the inspector — edit once, update all.
        </p>
      )}
      {textStyles.map((ts) => (
        <TextStyleRow key={ts.id} ts={ts} />
      ))}
      <button
        onClick={() => addTextStyle(`Text style ${textStyles.length + 1}`, { fontSize: "16px", lineHeight: "1.5" })}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-[12px] font-semibold text-zinc-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
      >
        <Plus size={13} /> Add text style
      </button>
    </div>
  );
}

export function ThemePanel() {
  const theme = useEditor((s) => s.theme);
  const setTheme = useEditor((s) => s.setTheme);

  return (
    <div className="pb-4">
      <PanelSection title="Theme" icon={<PaletteIcon size={12} />}>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500">Brand color</span>
            <button
              onClick={() => setTheme({ brand: PRESETS[Math.floor(Math.random() * PRESETS.length)] })}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              <Shuffle size={12} /> Shuffle
            </button>
          </div>
          <ColorInput value={theme.brand ?? ""} onChange={(v) => setTheme({ brand: v })} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setTheme({ brand: c })}
                className={cn("h-6 w-6 rounded-full ring-2 ring-offset-2 transition-transform hover:scale-110", theme.brand === c ? "ring-zinc-900" : "ring-transparent")}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <Field label="Font">
          <SelectInput value={theme.font ?? ""} onChange={(v) => setTheme({ font: v })} options={FONT_OPTIONS} />
        </Field>
        <Field label="Corner radius">
          <SelectInput value={theme.radius ?? ""} onChange={(v) => setTheme({ radius: v })} options={RADIUS_OPTIONS} />
        </Field>
      </PanelSection>

      <PanelSection title="Color styles" icon={<PaletteIcon size={12} />}>
        <ColorStyles />
      </PanelSection>

      <PanelSection title="Text styles" icon={<Type size={12} />}>
        <TextStyles />
      </PanelSection>

      <p className="mx-3 mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
        Color &amp; text styles are <span className="font-medium text-zinc-600">shared across every page</span> on the site.
      </p>
    </div>
  );
}
