"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Component as ComponentIcon, Copy, GripVertical, PanelRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useBreakpoints } from "@/store/breakpoints";
import { getDefinition } from "@/lib/blocks/registry";
import { useEditorActions } from "../editor-actions";
import { CUSTOM_INSPECTORS } from "../custom-inspectors";
import { StyleGroupView } from "./style-fields";
import {
  AttributesControl,
  ContentField,
  MotionSection,
  StyleActions,
  TextStyleControl,
  VisibilityControl,
  VP,
} from "./block-controls";

// --- inspector --------------------------------------------------------------

export function InspectorContent({
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
  const Custom = CUSTOM_INSPECTORS[block.type] ?? def.CustomContent;

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
              {Custom ? (
                <Custom block={block} />
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
