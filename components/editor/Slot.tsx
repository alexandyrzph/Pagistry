"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { canDrop } from "@/lib/blocks/tree";
import { getDefinition } from "@/lib/blocks/registry";
import { cn } from "@/lib/utils";
import { useDrag } from "./drag-context";

// Quick-add starters shown in the empty-canvas placeholder.
const STARTERS = ["hero", "features", "columns", "heading", "image", "cta"];

function allowedDrop(
  parentId: string | null,
  parentType: string | null,
  drag: ReturnType<typeof useDrag>
) {
  if (!drag.type) return false;
  if (!canDrop(parentType, drag.type)) return false;
  if (parentId && drag.invalid.has(parentId)) return false;
  return true;
}

/** Insertion line between two blocks; only active while dragging. */
export function Slot({
  parentId,
  parentType,
  index,
}: {
  parentId: string | null;
  parentType: string | null;
  index: number;
}) {
  const drag = useDrag();
  const allowed = allowedDrop(parentId, parentType, drag);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${parentId ?? "root"}:${index}`,
    data: { parentId, parentType, index },
    disabled: !allowed,
  });

  if (!drag.type || !allowed) return null;

  return (
    <div
      ref={setNodeRef}
      className="relative z-20"
      style={{ minHeight: 16, marginTop: -8, marginBottom: -8 }}
    >
      <AnimatePresence initial={false}>
        {isOver && (
          <motion.div
            key="line"
            initial={{ opacity: 0, scaleX: 0.7 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.18)]"
          >
            <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500" />
            <span className="absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Larger dashed drop target shown for empty containers. */
export function EmptyDrop({
  parentId,
  parentType,
  minHeight = 80,
}: {
  parentId: string | null;
  parentType: string | null;
  minHeight?: number;
}) {
  const drag = useDrag();
  const allowed = allowedDrop(parentId, parentType, drag);
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${parentId ?? "root"}:0`,
    data: { parentId, parentType, index: 0 },
    disabled: !allowed,
  });

  const isRoot = parentId === null && parentType === "root";

  // While dragging, behave as a drop target.
  if (drag.type) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm font-medium transition-colors duration-200",
          isOver ? "border-indigo-400 bg-indigo-50/70 text-indigo-600" : allowed ? "border-indigo-200 text-indigo-400" : "border-zinc-200 text-zinc-400"
        )}
        style={{ minHeight: Math.max(minHeight, isRoot ? 360 : minHeight) }}
      >
        {allowed ? "Drop here" : "Can't drop here"}
      </div>
    );
  }

  // Idle empty ROOT → rich placeholder with quick-add buttons.
  if (isRoot) {
    return (
      <div
        ref={setNodeRef}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/40 px-6 py-16 text-center"
        style={{ minHeight: Math.max(minHeight, 360) }}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <Sparkles size={22} />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-zinc-800">Start building your page</h3>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
          Generate a section with AI, add a block, or drag one from the left panel.
        </p>
        <button
          data-open-ai="1"
          className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Sparkles size={16} /> Generate with AI
        </button>
        <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
          <span className="h-px w-8 bg-zinc-200" /> or add a block <span className="h-px w-8 bg-zinc-200" />
        </div>
        <div className="grid w-full max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-3">
          {STARTERS.map((type) => {
            const def = getDefinition(type);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <button
                key={type}
                type="button"
                data-add-block={type}
                data-add-parent="root"
                className="group flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 py-3.5 shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
                  <Icon size={17} />
                </span>
                <span className="text-xs font-medium text-zinc-600 group-hover:text-indigo-700">{def.label}</span>
              </button>
            );
          })}
        </div>
        <button
          data-open-inserter="root"
          className="mt-4 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
        >
          Browse all blocks →
        </button>
      </div>
    );
  }

  // Idle empty container → compact add hint.
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-200 text-sm font-medium text-zinc-400"
      style={{ minHeight }}
    >
      <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-zinc-400">
        <Sparkles size={13} /> Drag blocks here
      </span>
    </div>
  );
}
