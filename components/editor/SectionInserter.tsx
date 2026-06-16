"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";
import { CATEGORIES, createBlock, getDefinition } from "@/lib/blocks/registry";
import { findBlockById } from "@/lib/blocks/tree";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { Wireframe } from "./Wireframe";

export function SectionInserter() {
  const inserter = useEditorUI((s) => s.inserter);
  const close = useEditorUI((s) => s.closeInserter);
  const openAi = useEditorUI((s) => s.openAi);
  const addBlock = useEditor((s) => s.addBlock);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!inserter) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inserter, close]);

  if (!inserter) return null;

  const target = inserter;
  const query = q.trim().toLowerCase();
  const matches = (type: string) => {
    const def = getDefinition(type);
    if (!def) return false;
    return def.label.toLowerCase().includes(query) || (def.description ?? "").toLowerCase().includes(query);
  };

  const pick = (type: string) => {
    const tree = useEditor.getState().tree;
    let index = target.index;
    if (index < 0) {
      index = target.parentId ? findBlockById(tree, target.parentId)?.children.length ?? 0 : tree.length;
    }
    addBlock(type, target.parentId, index);
    close();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-start justify-center bg-zinc-900/40 p-6 pt-[8vh] backdrop-blur-sm"
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header / search */}
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search blocks to add…"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <button
              onClick={() => {
                close();
                openAi(target);
              }}
              title="Generate with AI"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e8eaed] bg-white px-3 py-1.5 text-sm font-semibold text-[#111827] shadow-xs transition-colors hover:bg-zinc-50"
            >
              <Sparkles size={14} className="text-indigo-600" /> AI
            </button>
            <button onClick={close} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
              <X size={18} />
            </button>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
            {CATEGORIES.map((cat) => {
              const types = cat.types.filter(matches);
              if (!types.length) return null;
              return (
                <div key={cat.name}>
                  <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                    {cat.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {types.map((type) => {
                      const def = getDefinition(type)!;
                      return (
                        <button
                          key={type}
                          onClick={() => pick(type)}
                          title={def.description ?? def.label}
                          className={cn(
                            "group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                          )}
                        >
                          <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-2.5 transition-colors group-hover:bg-indigo-50/40">
                            <Wireframe block={createBlock(type)} />
                          </div>
                          <span className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-zinc-600 group-hover:text-indigo-700">
                            <def.icon size={13} className="shrink-0 text-zinc-400 group-hover:text-indigo-500" />
                            {def.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {CATEGORIES.every((c) => !c.types.filter(matches).length) && (
              <p className="py-10 text-center text-sm text-zinc-400">No blocks match “{q}”.</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
