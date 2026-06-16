"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { getDefinition } from "@/lib/blocks/registry";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";

function LayerRow({ block, depth }: { block: Block; depth: number }) {
  const def = getDefinition(block.type);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const hover = useEditor((s) => s.hover);
  const remove = useEditor((s) => s.remove);

  if (!def) return null;
  const Icon = def.icon;
  const selected = selectedId === block.id;
  const label =
    block.props.text || block.props.title || block.props.brand || def.label;

  return (
    <>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-sm transition-colors",
          selected ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => select(block.id)}
        onMouseEnter={() => hover(block.id)}
        onMouseLeave={() => hover(null)}
      >
        {block.children.length > 0 ? (
          <ChevronRight size={13} className="shrink-0 opacity-50" />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        <Icon size={14} className="shrink-0 opacity-70" />
        <span className="truncate">{String(label).slice(0, 28)}</span>
        <button
          className="ml-auto rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-red-500 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            remove(block.id);
          }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {block.children.map((c) => (
        <LayerRow key={c.id} block={c} depth={depth + 1} />
      ))}
    </>
  );
}

export function Layers() {
  const tree = useEditor((s) => s.tree);
  if (tree.length === 0) {
    return (
      <p className="p-4 text-sm text-zinc-400">
        No blocks yet. Add some from the Components tab.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {tree.map((b) => (
        <LayerRow key={b.id} block={b} depth={0} />
      ))}
    </div>
  );
}
