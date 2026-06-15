"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronDown, ClipboardPaste, Component as ComponentIcon, Copy, Eye, EyeOff, GripVertical, Link2, Monitor, PanelRight, Plus, Smartphone, Tablet, Trash2, Type, X } from "lucide-react";
import { getDefinition } from "@/lib/registry";
import { findBlockById } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { Block, SettingField, StyleGroup, StyleProps, Viewport } from "@/lib/types";
import { useEditor, useSelectedBlock } from "@/store/editor-store";
import { useBreakpoints } from "@/store/breakpoints";
import { useDesignSystem } from "@/store/design-system";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useEditorActions } from "./editor-actions";
import { useIframe } from "./iframe-context";
import { useDrag } from "./drag-context";
import {
  ColorInput,
  Field,
  FileInput,
  IconPicker,
  ImageInput,
  ItemsEditor,
  NumberInput,
  Segmented,
  SelectInput,
  Slider,
  StringList,
  TextArea,
  TextInput,
  Toggle,
  UnitInput,
} from "./controls";

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

const FONT_WEIGHTS = [
  { label: "Default", value: "" },
  { label: "Light", value: "300" },
  { label: "Normal", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Extra bold", value: "800" },
];
const SHADOWS = [
  { label: "None", value: "" },
  { label: "Small", value: "0 1px 2px rgba(0,0,0,0.06)" },
  { label: "Medium", value: "0 4px 6px rgba(0,0,0,0.08)" },
  { label: "Large", value: "0 10px 20px rgba(0,0,0,0.12)" },
  { label: "X-Large", value: "0 20px 30px rgba(0,0,0,0.16)" },
];
const opt = (...vals: string[]) => [
  { label: "Default", value: "" },
  ...vals.map((v) => ({ label: v, value: v })),
];
const ALIGN_SEG = [
  { value: "left", label: "Left", icon: <AlignLeft size={14} /> },
  { value: "center", label: "Center", icon: <AlignCenter size={14} /> },
  { value: "right", label: "Right", icon: <AlignRight size={14} /> },
  { value: "justify", label: "Justify", icon: <AlignJustify size={14} /> },
];

function StyleGroupView({ group }: { group: StyleGroup }) {
  switch (group) {
    case "typography":
      return (
        <Section title="Typography">
          <SUnit label="Font size" k="fontSize" units={["px", "rem", "em"]} placeholder="16" />
          <SSelect label="Weight" k="fontWeight" options={FONT_WEIGHTS} />
          <SColor label="Text color" k="color" />
          <div className="grid grid-cols-2 gap-2">
            <SUnit label="Line height" k="lineHeight" units={["", "px", "rem"]} placeholder="1.5" />
            <SUnit label="Letter spacing" k="letterSpacing" units={["px", "em"]} placeholder="0" />
          </div>
          <SSegment label="Align" k="textAlign" options={ALIGN_SEG} />
          <SSelect label="Transform" k="textTransform" options={opt("none", "uppercase", "capitalize", "lowercase")} />
        </Section>
      );
    case "spacing":
      return (
        <Section title="Spacing">
          <SpacingControl label="Padding" keys={["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]} />
          <SpacingControl label="Margin" keys={["marginTop", "marginRight", "marginBottom", "marginLeft"]} />
        </Section>
      );
    case "background":
      return (
        <Section title="Background" defaultOpen={false}>
          <SColor label="Background color" k="backgroundColor" />
          <SText label="Background image / gradient" k="backgroundImage" placeholder="url(…) or linear-gradient(…)" />
        </Section>
      );
    case "border":
      return (
        <Section title="Border" defaultOpen={false}>
          <SUnit label="Radius" k="borderRadius" units={["px", "%", "rem"]} placeholder="12" />
          <div className="grid grid-cols-2 gap-2">
            <SUnit label="Width" k="borderWidth" units={["px"]} placeholder="1" />
            <SSelect label="Style" k="borderStyle" options={opt("solid", "dashed", "dotted", "none")} />
          </div>
          <SColor label="Border color" k="borderColor" />
        </Section>
      );
    case "effects":
      return (
        <Section title="Effects" defaultOpen={false}>
          <SSelect label="Shadow" k="boxShadow" options={SHADOWS} />
          <SOpacity />
        </Section>
      );
    case "layout":
      return (
        <Section title="Layout" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <SUnit label="Max width" k="maxWidth" units={["px", "%", "rem"]} placeholder="auto" />
            <SUnit label="Min height" k="minHeight" units={["px", "vh", "rem", "auto"]} placeholder="auto" />
          </div>
          <SSelect label="Display" k="display" options={opt("block", "flex", "grid", "inline-block", "none")} />
          <div className="grid grid-cols-2 gap-2">
            <SSelect label="Align items" k="alignItems" options={opt("flex-start", "center", "flex-end", "stretch")} />
            <SSelect label="Justify" k="justifyContent" options={opt("flex-start", "center", "flex-end", "space-between", "space-around")} />
          </div>
          <SUnit label="Gap" k="gap" units={["px", "rem"]} placeholder="16" />
        </Section>
      );
  }
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

// Apply a shared text style to the block, or save its current look as one.
function TextStyleControl({ block }: { block: Block }) {
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
function StyleActions({ block }: { block: Block }) {
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

// Per-breakpoint visibility toggles (independent eye switches).
function VisibilityControl({ block }: { block: Block }) {
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
function AttributesControl({ block }: { block: Block }) {
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

function MotionSection({ block }: { block: Block }) {
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

function ContentField({
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

  switch (field.type) {
    case "textarea":
      return <Field label={field.label}><TextArea value={value ?? ""} onChange={set} placeholder={field.placeholder} /></Field>;
    case "code":
      return (
        <Field label={field.label}>
          <textarea
            value={value ?? ""}
            onChange={(e) => set(e.target.value)}
            placeholder={field.placeholder}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </Field>
      );
    case "number":
      return <Field label={field.label}><NumberInput value={value ?? ""} onChange={set} placeholder={field.placeholder} /></Field>;
    case "select":
      return <Field label={field.label}><SelectInput value={String(value ?? "")} onChange={set} options={field.options ?? []} /></Field>;
    case "color":
      return <Field label={field.label}><ColorInput value={value ?? ""} onChange={set} /></Field>;
    case "boolean":
      return <Field label={field.label}><Toggle value={!!value} onChange={set} /></Field>;
    case "icon":
      return <Field label={field.label}><IconPicker value={value ?? "Star"} onChange={set} /></Field>;
    case "image":
      return <Field label={field.label}><ImageInput value={value ?? ""} onChange={set} /></Field>;
    case "file":
      return <Field label={field.label}><FileInput value={value ?? ""} onChange={set} /></Field>;
    case "stringlist":
      return <Field label={field.label}><StringList value={value ?? []} onChange={set} /></Field>;
    case "items":
      return <Field label={field.label}><ItemsEditor value={value ?? []} itemFields={field.itemFields ?? []} onChange={set} /></Field>;
    default:
      return <Field label={field.label}><TextInput value={value ?? ""} onChange={set} placeholder={field.placeholder} /></Field>;
  }
}

// --- viewport switcher ------------------------------------------------------

const VP: { id: Viewport; icon: React.ReactNode }[] = [
  { id: "desktop", icon: <Monitor size={14} /> },
  { id: "tablet", icon: <Tablet size={14} /> },
  { id: "mobile", icon: <Smartphone size={14} /> },
];

// --- inspector --------------------------------------------------------------

function InspectorContent({
  block,
  onHandlePointerDown,
  dragging,
  docked,
  onToggleDock,
}: {
  block: Block;
  onHandlePointerDown?: (e: React.PointerEvent) => void;
  dragging?: boolean;
  docked?: boolean;
  onToggleDock?: () => void;
}) {
  const [tab, setTab] = useState<"content" | "style">("content");
  const viewport = useEditor((s) => s.viewport);
  const { setActive } = useBreakpoints();
  const duplicate = useEditor((s) => s.duplicate);
  const remove = useEditor((s) => s.remove);
  const select = useEditor((s) => s.select);
  const actions = useEditorActions();

  const def = getDefinition(block.type);
  if (!def) return null;
  const Icon = def.icon;

  return (
    <>
      {/* header (drag handle) */}
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 py-2 pl-2 pr-2">
        <div
          onPointerDown={onHandlePointerDown}
          className={cn(
            "flex flex-1 select-none items-center gap-2 rounded-lg py-0.5 pl-1 pr-2",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
          title="Drag to move panel"
        >
          <span className="flex items-center text-zinc-300">
            <GripVertical size={14} />
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon size={15} />
          </div>
          <span className="flex-1 truncate text-sm font-semibold tracking-tight text-zinc-800">{def.label}</span>
        </div>
        {block.type !== "component" && (
          <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-600" title="Save as component" onClick={() => actions.saveAsComponent(block)}>
            <ComponentIcon size={14} />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" title="Duplicate" onClick={() => duplicate(block.id)}>
          <Copy size={14} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Delete" onClick={() => remove(block.id)}>
          <Trash2 size={14} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          className={cn("rounded-lg p-1.5 transition-colors hover:bg-zinc-100", docked ? "text-indigo-600" : "text-zinc-400 hover:text-zinc-600")}
          title={docked ? "Float panel" : "Dock to right"}
          onClick={onToggleDock}
        >
          <PanelRight size={14} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600" title="Close" onClick={() => select(null)}>
          <X size={14} />
        </motion.button>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 gap-1 border-b border-zinc-200 p-2">
        {(["content", "style"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-indigo-50 text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3"
        >
          {tab === "content" ? (
            <>
              {def.CustomContent ? (
                <def.CustomContent block={block} />
              ) : def.fields.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  This block has no content options — use Attributes below or the Style tab.
                </p>
              ) : (
                def.fields.map((f) => (
                  <ContentField key={f.key} field={f} blockId={block.id} value={(block.props as any)[f.key]} />
                ))
              )}
              <AttributesControl block={block} />
            </>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-[11px] font-medium text-zinc-500">Editing viewport</span>
                <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
                  {VP.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setActive(v.id)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium capitalize transition-colors",
                        viewport === v.id ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {v.icon}
                      {v.id}
                    </button>
                  ))}
                </div>
                {viewport !== "desktop" && (
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                    Overrides the desktop value on {viewport} and below.
                  </p>
                )}
              </div>
              <TextStyleControl block={block} />
              <StyleActions block={block} />
              <VisibilityControl block={block} />
              {def.styleGroups.map((g) => (
                <StyleGroupView key={g} group={g} />
              ))}
              <MotionSection block={block} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// --- floating panel positioning --------------------------------------------

const PANEL_WIDTH = 304;
const LEFT_PANEL = 256; // keep clear of the components panel
const GAP = 14;

type PanelPos = { left: number; top: number; maxHeight: number };

const DOCK_THRESHOLD = 60; // px from the right edge that triggers docking
const clampW = (w: number) => Math.max(264, Math.min(w, 560));

export function FloatingInspector() {
  const block = useSelectedBlock();
  const selectedId = useEditor((s) => s.selectedId);
  const tree = useEditor((s) => s.tree);
  const viewport = useEditor((s) => s.viewport);
  const previewMode = useEditor((s) => s.previewMode);
  const select = useEditor((s) => s.select);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [dragPos, setDragPos] = useState<PanelPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [docked, setDocked] = useState(false);
  const [dockHint, setDockHint] = useState(false);
  const [width, setWidth] = useState(PANEL_WIDTH);
  const { frame, tick } = useIframe();
  const zoom = useCanvasZoom((s) => s.zoom);
  const dragActive = !!useDrag().type;

  // While dragging/resizing the panel, make the canvas iframe transparent to
  // pointer events. Otherwise, when the cursor crosses into the cross-document
  // iframe it swallows pointermove/pointerup and the drag silently stops.
  const setFramePassthrough = (on: boolean) => {
    const el = frame?.el;
    if (!el) return;
    if (on) el.style.setProperty("pointer-events", "none");
    else el.style.removeProperty("pointer-events");
  };

  // re-anchor to the newly selected block (drop any manual float position)
  useEffect(() => {
    setDragPos(null);
  }, [selectedId]);

  // ESC closes the panel (deselect)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useEditor.getState().selectedId) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  function handlePointerDown(e: React.PointerEvent) {
    const vw = window.innerWidth;
    let base = dragPos ?? pos;
    if (docked) {
      // undock: pop out as a floating panel near the right edge
      base = { left: Math.max(8, vw - width - 16), top: 72, maxHeight: window.innerHeight - 88 };
      setDocked(false);
      setDragPos(base);
    }
    if (!base) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = base.left;
    const startTop = base.top;
    setDragging(true);
    setFramePassthrough(true);
    const onMove = (ev: PointerEvent) => {
      const left = Math.max(8, Math.min(startLeft + ev.clientX - startX, vw - width - 8));
      const top = Math.max(56, Math.min(startTop + ev.clientY - startY, window.innerHeight - 90));
      setDragPos({ left, top, maxHeight: window.innerHeight - top - 16 });
      setDockHint(ev.clientX > vw - DOCK_THRESHOLD);
    };
    const onUp = (ev: PointerEvent) => {
      setDragging(false);
      setFramePassthrough(false);
      if (ev.clientX > vw - DOCK_THRESHOLD) setDocked(true);
      setDockHint(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    e.preventDefault();
  }

  function handleResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const vw = window.innerWidth;
    const base = dragPos ?? pos;
    const rightEdge = docked ? vw : base ? base.left + width : vw - 8;
    setResizing(true);
    setFramePassthrough(true);
    const onMove = (ev: PointerEvent) => {
      const w = clampW(rightEdge - ev.clientX);
      setWidth(w);
      if (!docked && base) {
        setDragPos({ left: rightEdge - w, top: base.top, maxHeight: base.maxHeight });
      }
    };
    const onUp = () => {
      setResizing(false);
      setFramePassthrough(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const compute = useCallback(() => {
    if (!selectedId) return setPos(null);
    const doc = frame?.doc ?? document;
    const el = doc.querySelector(`[data-block-id="${selectedId}"]`);
    if (!el) return setPos(null);
    const r = el.getBoundingClientRect();
    // translate iframe-relative rect into top-document viewport coords. Blocks
    // inside the iframe are in unscaled internal px, so scale by the canvas zoom
    // to match the visually scaled iframe before offsetting by its position.
    const inFrame = !!(frame && el.ownerDocument === frame.doc);
    const off = inFrame ? frame!.el.getBoundingClientRect() : { left: 0, top: 0 };
    const sc = inFrame ? zoom : 1;
    const rect = { top: r.top * sc + off.top, left: r.left * sc + off.left, right: r.right * sc + off.left };
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    if (rect.right + GAP + width <= vw - 8) left = rect.right + GAP;
    else if (rect.left - GAP - width >= LEFT_PANEL + 8) left = rect.left - GAP - width;
    else left = vw - width - 8;

    const top = Math.max(64, Math.min(rect.top, vh - 360));
    setPos({ left, top, maxHeight: vh - top - 16 });
  }, [selectedId, width, frame, zoom]);

  useLayoutEffect(() => {
    compute();
  }, [compute, tree, viewport, tick]);

  useEffect(() => {
    if (!selectedId) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    // iframe-internal scroll doesn't propagate to the parent window, so listen on
    // the iframe's own window too (the canvas no longer bumps `tick` on scroll).
    const fw = frame?.el.contentWindow;
    fw?.addEventListener("scroll", onScroll, true);
    let ro: ResizeObserver | undefined;
    const el = document.querySelector(`[data-block-id="${selectedId}"]`);
    if (el && "ResizeObserver" in window) {
      ro = new ResizeObserver(onScroll);
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      fw?.removeEventListener("scroll", onScroll, true);
      ro?.disconnect();
    };
  }, [selectedId, compute, frame]);

  const eff = dragPos ?? pos;
  const show = !!block && !previewMode && !dragActive && (docked || !!eff);

  const style: React.CSSProperties = docked
    ? { position: "fixed", top: 56, right: 0, bottom: 0, width }
    : {
        position: "fixed",
        left: eff?.left ?? 0,
        top: eff?.top ?? 64,
        width,
        maxHeight: eff?.maxHeight,
      };

  return (
    <>
      {/* dock-zone preview while dragging toward the right edge */}
      {dragging && dockHint && (
        <div
          className="pointer-events-none fixed z-[39] border-l-2 border-indigo-400 bg-indigo-500/10"
          style={{ top: 56, bottom: 0, right: 0, width }}
        />
      )}
      <AnimatePresence>
        {show && block && (
          <motion.aside
            key={block.id}
            initial={{ opacity: 0, scale: 0.97, x: docked ? 8 : -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={dragging || resizing ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34 }}
            style={style}
            className={cn(
              "z-40 flex flex-col overflow-hidden border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5",
              docked ? "border-l rounded-none" : "rounded-2xl border",
              (dragging || resizing) && "ring-indigo-300/60 select-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* resize handle on the left edge */}
            <div
              onPointerDown={handleResizeDown}
              className="group absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize"
              title="Drag to resize"
            >
              <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-indigo-400" />
            </div>
            <InspectorContent
              block={block}
              onHandlePointerDown={handlePointerDown}
              dragging={dragging}
              docked={docked}
              onToggleDock={() => setDocked((d) => !d)}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
