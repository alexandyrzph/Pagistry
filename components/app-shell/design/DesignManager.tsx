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
  useEffect(() => { if (!ds.loaded) ds.load(); }, [ds.loaded, ds.load]);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
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
              const set = (k: keyof StyleProps, v: string) => ds.updateTextStyleProp(t.id, k, v);
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
                    <Field label="Line height"><TextInput value={p.lineHeight || ""} onChange={(v: string) => set("lineHeight", v)} placeholder="1.4" /></Field>
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
