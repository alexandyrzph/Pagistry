"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { CATEGORIES, getDefinition } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";

function PaletteItem({ type }: { type: string }) {
  const def = getDefinition(type);
  const addBlock = useEditor((s) => s.addBlock);
  const treeLen = useEditor((s) => s.tree.length);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { kind: "new", blockType: type },
  });

  if (!def) return null;
  const Icon = def.icon;

  return (
    <motion.button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => addBlock(type, null, treeLen)}
      title={def.description ?? def.label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group flex h-[72px] cursor-grab touch-none flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-1 text-center shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
        <Icon size={16} />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-600 group-hover:text-indigo-700">
        {def.label}
      </span>
    </motion.button>
  );
}

export function Palette() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  const matches = (type: string) => {
    const def = getDefinition(type);
    if (!def) return false;
    return def.label.toLowerCase().includes(q) || (def.description ?? "").toLowerCase().includes(q);
  };
  const allTypes = CATEGORIES.flatMap((c) => c.types);
  const results = allTypes.filter(matches);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks…"
          className="w-full rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-2 text-xs text-zinc-800 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {q ? (
        results.length ? (
          <div className="grid grid-cols-3 gap-2">
            {results.map((type) => (
              <PaletteItem key={type} type={type} />
            ))}
          </div>
        ) : (
          <p className="px-1 py-4 text-center text-xs text-zinc-400">No blocks match “{query}”.</p>
        )
      ) : (
        CATEGORIES.map((cat) => {
          const open = !collapsed[cat.name];
          return (
            <div key={cat.name}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [cat.name]: open }))}
                className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 transition-colors hover:text-zinc-600"
              >
                {cat.name}
                <ChevronDown size={13} className={cn("transition-transform", !open && "-rotate-90")} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 pb-1 pt-1.5">
                      {cat.types.map((type) => (
                        <PaletteItem key={type} type={type} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </div>
  );
}
