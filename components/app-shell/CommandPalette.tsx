"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { ALL_NAV } from "./nav";

type Cmd = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [pages, setPages] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQ(""); setSel(0); return; }
    inputRef.current?.focus();
    fetch("/api/pages").then((r) => r.json()).then((d) => Array.isArray(d) && setPages(d.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })))).catch(() => {});
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => { onClose(); router.push(href); };
    const nav: Cmd[] = ALL_NAV.map((n) => ({ id: "nav:" + n.href, label: n.label, hint: "Go to", run: go(n.href) }));
    const actions: Cmd[] = [
      { id: "act:settings", label: "Workspace settings", hint: "Action", run: go("/settings") },
      { id: "act:account", label: "Account settings", hint: "Action", run: go("/account") },
      { id: "act:members", label: "Invite a teammate", hint: "Action", run: go("/settings#members") },
    ];
    const pageCmds: Cmd[] = pages.map((p) => ({ id: "page:" + p.id, label: p.title, hint: "Edit page", run: () => { onClose(); router.push(`/editor/${p.id}`); } }));
    return [...nav, ...actions, ...pageCmds];
  }, [pages, router, onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.slice(0, 12);
    return commands.filter((c) => c.label.toLowerCase().includes(s)).slice(0, 20);
  }, [q, commands]);

  useEffect(() => { setSel(0); }, [q]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[sel]?.run(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-900/40 p-4 pt-[15vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
              <Search size={17} className="text-zinc-400" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search pages, sections, actions…" className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-zinc-400" />
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-400">No results</p>}
              {filtered.map((c, i) => (
                <button key={c.id} onMouseEnter={() => setSel(i)} onClick={c.run}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${i === sel ? "bg-indigo-50 text-indigo-900" : "text-zinc-700"}`}>
                  <span className="truncate">{c.label}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">{c.hint}{i === sel && <CornerDownLeft size={12} />}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
