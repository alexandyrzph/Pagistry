"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Component as ComponentIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/dialog-provider";
import { useEditor } from "@/store/editor-store";
import { useComponents, type ComponentItem } from "./components-context";

function CompItem({ c }: { c: ComponentItem }) {
  const router = useRouter();
  const components = useComponents();
  const confirm = useConfirm();
  const addComponentInstance = useEditor((s) => s.addComponentInstance);
  const treeLen = useEditor((s) => s.tree.length);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:component:${c.id}`,
    data: { kind: "new", blockType: "component", componentId: c.id },
  });

  async function del(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete component?",
      message: `"${c.name}" will be deleted. Existing instances will show "not found".`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/components/${c.id}`, { method: "DELETE" });
    await components.refresh();
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => addComponentInstance(c.id, null, treeLen)}
      title={`Insert "${c.name}"`}
      className={cn(
        "group flex cursor-grab touch-none items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-2 shadow-xs transition-colors hover:border-violet-300 hover:bg-violet-50/50 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600">
        <ComponentIcon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700">{c.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/component/${c.id}`);
        }}
        title="Edit component"
        className="rounded p-1 text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-violet-600 group-hover:opacity-100"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={del}
        title="Delete component"
        className="rounded p-1 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

export function ReusableComponents() {
  const components = useComponents();
  if (!components.list.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs leading-relaxed text-zinc-400">
        No saved components yet. Select any block on the canvas and choose{" "}
        <span className="font-semibold text-zinc-500">Save as component</span> to reuse it
        across pages — edits sync everywhere.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {components.list.map((c) => (
        <CompItem key={c.id} c={c} />
      ))}
    </div>
  );
}
