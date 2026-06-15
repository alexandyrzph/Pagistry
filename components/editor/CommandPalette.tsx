"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  Download,
  Eye,
  LayoutDashboard,
  Monitor,
  Plus,
  Redo2,
  Rocket,
  Save,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, getDefinition } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";

type Command = {
  id: string;
  group: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
};

/** Subsequence match — "hdg" matches "Heading". Returns a score or -1. */
function score(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : -1;
}

export function CommandPalette({
  open,
  onClose,
  onSave,
  onExport,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onExport: () => void;
  onPublish: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const s = useEditor.getState();
    const insert: Command[] = CATEGORIES.flatMap((cat) =>
      cat.types.map((type) => {
        const def = getDefinition(type)!;
        return {
          id: `insert:${type}`,
          group: "Insert block",
          label: `Add ${def.label}`,
          icon: def.icon,
          keywords: `${cat.name} ${def.description ?? ""}`,
          run: () => useEditor.getState().addBlock(type, null, useEditor.getState().tree.length),
        };
      })
    );

    const actions: Command[] = [
      { id: "vp:desktop", group: "View", label: "Desktop view", icon: Monitor, run: () => s.setViewport("desktop") },
      { id: "vp:tablet", group: "View", label: "Tablet view", icon: Tablet, run: () => s.setViewport("tablet") },
      { id: "vp:mobile", group: "View", label: "Mobile view", icon: Smartphone, run: () => s.setViewport("mobile") },
      { id: "preview", group: "View", label: "Toggle preview", icon: Eye, run: () => useEditor.getState().togglePreview() },
      { id: "undo", group: "Edit", label: "Undo", icon: Undo2, run: () => useEditor.getState().undo() },
      { id: "redo", group: "Edit", label: "Redo", icon: Redo2, run: () => useEditor.getState().redo() },
      {
        id: "dup",
        group: "Edit",
        label: "Duplicate selected block",
        icon: Copy,
        run: () => {
          const id = useEditor.getState().selectedId;
          if (id) useEditor.getState().duplicate(id);
        },
      },
      {
        id: "del",
        group: "Edit",
        label: "Delete selected block",
        icon: Trash2,
        run: () => {
          const id = useEditor.getState().selectedId;
          if (id) useEditor.getState().remove(id);
        },
      },
      { id: "save", group: "Page", label: "Save page", icon: Save, run: onSave },
      { id: "publish", group: "Page", label: "Publish page", icon: Rocket, run: onPublish },
      { id: "export", group: "Page", label: "Export as HTML", icon: Download, run: onExport },
      { id: "home", group: "Page", label: "Go to all pages", icon: LayoutDashboard, run: () => router.push("/") },
    ];

    return [...actions, ...insert];
  }, [onSave, onExport, onPublish, router]);

  const results = useMemo(() => {
    if (!query) return commands;
    return commands
      .map((c) => ({ c, sc: Math.max(score(query, c.label), score(query, c.keywords ?? "") - 1) }))
      .filter((r) => r.sc >= 0)
      .sort((a, b) => b.sc - a.sc)
      .map((r) => r.c);
  }, [commands, query]);

  // group results preserving order
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of results) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [results]);

  const flat = results;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // keep active item scrolled into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (c?: Command) => {
    if (!c) return;
    c.run();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-900/40 p-4 pt-[12vh] backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          transition={{ type: "spring", stiffness: 460, damping: 32 }}
          className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
            <Search size={18} className="shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search blocks…"
              className="w-full bg-transparent py-3.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, flat.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  run(flat[active]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
                e.stopPropagation();
              }}
            />
            <kbd className="hidden shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 sm:block">
              ESC
            </kbd>
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {flat.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-400">No matching commands.</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {group}
                  </p>
                  {items.map((c) => {
                    const idx = flat.indexOf(c);
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        data-idx={idx}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => run(c)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          idx === active ? "bg-indigo-50 text-indigo-700" : "text-zinc-700 hover:bg-zinc-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            idx === active ? "bg-white text-indigo-600 shadow-xs" : "bg-zinc-100 text-zinc-500"
                          )}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.group === "Insert block" && idx === active && (
                          <Plus size={13} className="text-indigo-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-semibold">↑</kbd>
              <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-semibold">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-semibold">↵</kbd>
              to run
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
