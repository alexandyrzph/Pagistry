"use client";

import { ClipboardPaste, Copy, Eye, EyeOff, Monitor, Plus, Smartphone, Tablet, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block, SettingField, Viewport } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useDesignSystem } from "@/store/design-system";
import { Field, NumberInput, SelectInput, TextInput } from "../controls";
import { ItemsEditor, LEAF_INPUTS } from "@/lib/field-inputs";
import { Section } from "./style-fields";

// Apply a shared text style to the block, or save its current look as one.
export function TextStyleControl({ block }: { block: Block }) {
  const textStyles = useDesignSystem((s) => s.textStyles);
  const addTextStyle = useDesignSystem((s) => s.addTextStyle);
  const setProp = useEditor((s) => s.setProp);
  const current = (block.props.textStyle as string) || "";
  const options = [{ label: "None", value: "" }, ...textStyles.map((t) => ({ label: t.name, value: t.id }))];
  const saveFromBlock = () => {
    const props = { ...(block.styles.desktop ?? {}) };
    const ts = addTextStyle(`Text style ${textStyles.length + 1}`, props);
    setProp(block.id, "textStyle", ts.id);
  };
  return (
    <div>
      <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
        <Type size={11} /> Text style
      </span>
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <SelectInput value={current} onChange={(v) => setProp(block.id, "textStyle", v)} options={options} />
        </div>
        <button
          type="button"
          onClick={saveFromBlock}
          title="Save current styles as a reusable text style"
          className="flex shrink-0 items-center rounded-lg border border-zinc-200 px-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// Copy / paste the block's whole responsive style set.
export function StyleActions({ block }: { block: Block }) {
  const copyStyles = useEditor((s) => s.copyStyles);
  const pasteStyles = useEditor((s) => s.pasteStyles);
  const selectedIds = useEditor((s) => s.selectedIds);
  const many = selectedIds.length > 1;
  const btn =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800";
  return (
    <div className="flex gap-1.5">
      <button type="button" className={btn} onClick={() => copyStyles(block.id)} title="Copy styles (⌘⌥C)">
        <Copy size={13} /> Copy styles
      </button>
      <button type="button" className={btn} onClick={() => pasteStyles(block.id)} title="Paste styles (⌘⌥V)">
        <ClipboardPaste size={13} /> Paste{many ? ` to ${selectedIds.length}` : ""}
      </button>
    </div>
  );
}

export const VP: { id: Viewport; icon: React.ReactNode }[] = [
  { id: "desktop", icon: <Monitor size={14} /> },
  { id: "tablet", icon: <Tablet size={14} /> },
  { id: "mobile", icon: <Smartphone size={14} /> },
];

// Per-breakpoint visibility toggles (independent eye switches).
export function VisibilityControl({ block }: { block: Block }) {
  const setProp = useEditor((s) => s.setProp);
  const hidden = (block.props.hidden ?? {}) as Partial<Record<Viewport, boolean>>;
  const toggle = (vp: Viewport) => setProp(block.id, "hidden", { ...hidden, [vp]: !hidden[vp] });
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-zinc-500">Visibility</span>
      <div className="flex gap-1">
        {VP.map((v) => {
          const off = !!hidden[v.id];
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.id)}
              title={`${off ? "Show" : "Hide"} on ${v.id}`}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors",
                off ? "border-amber-200 bg-amber-50 text-amber-600" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              )}
            >
              {v.icon}
              {off ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">Hide this block on specific screen sizes.</p>
    </div>
  );
}

// Universal custom attributes — an HTML id + extra CSS classes on the block
// root, for targeting with custom CSS/JS, anchor links or the Embed block.
export function AttributesControl({ block }: { block: Block }) {
  const setProp = useEditor((s) => s.setProp);
  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Attributes</p>
      <Field label="HTML ID">
        <TextInput
          value={(block.props.htmlId as string) ?? ""}
          onChange={(v) => setProp(block.id, "htmlId", v)}
          placeholder="e.g. pricing"
        />
      </Field>
      <Field label="CSS classes">
        <TextInput
          value={(block.props.htmlClass as string) ?? ""}
          onChange={(v) => setProp(block.id, "htmlClass", v)}
          placeholder="space-separated e.g. dark card"
        />
      </Field>
    </div>
  );
}

const ANIM_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Fade up", value: "fade-up" },
  { label: "Fade in", value: "fade-in" },
  { label: "Zoom in", value: "zoom-in" },
  { label: "Slide from left", value: "slide-left" },
  { label: "Slide from right", value: "slide-right" },
];

export function MotionSection({ block }: { block: Block }) {
  const setProp = useEditor((s) => s.setProp);
  const animation = (block.props.animation as string) || "none";
  const delay = (block.props.animationDelay as number) ?? 0;
  return (
    <Section title="Motion">
      <Field label="Scroll animation">
        <SelectInput
          value={animation}
          onChange={(v) => setProp(block.id, "animation", v)}
          options={ANIM_OPTIONS}
        />
      </Field>
      {animation !== "none" && (
        <Field label="Delay (seconds)">
          <NumberInput
            value={delay}
            onChange={(v) => setProp(block.id, "animationDelay", v)}
            placeholder="0"
          />
        </Field>
      )}
      <p className="text-[11px] leading-snug text-zinc-400">
        Plays when the block scrolls into view — in Preview and on the published page.
      </p>
    </Section>
  );
}

// --- content fields ---------------------------------------------------------

export function ContentField({
  field,
  blockId,
  value,
}: {
  field: SettingField;
  blockId: string;
  value: any;
}) {
  const setProp = useEditor((s) => s.setProp);
  const set = (v: any) => setProp(blockId, field.key, v);

  if (field.type === "items") {
    return (
      <Field label={field.label}>
        <ItemsEditor value={value ?? []} itemFields={field.itemFields ?? []} onChange={set} />
      </Field>
    );
  }

  const render = LEAF_INPUTS[field.type] ?? LEAF_INPUTS.text;
  return (
    <Field label={field.label}>
      {render({ value, onChange: set, options: field.options, placeholder: field.placeholder })}
    </Field>
  );
}
