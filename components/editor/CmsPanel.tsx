"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Loader2, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollections } from "./collections-context";
import { CmsManagerModal } from "./CmsManagerModal";

export function CmsPanel() {
  const { list, refresh } = useCollections();
  const [managingId, setManagingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const c = await r.json();
      setName("");
      await refresh();
      if (c?.id) setManagingId(c.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-3">
      {/* create */}
      <div className="mb-3 flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="New collection name"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
        <button
          onClick={create}
          disabled={!name.trim() || creating}
          title="Create collection"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs leading-relaxed text-zinc-400">
          Model your content once — a <span className="font-semibold text-zinc-500">Blog</span>,{" "}
          <span className="font-semibold text-zinc-500">Team</span> or{" "}
          <span className="font-semibold text-zinc-500">Products</span> collection — then drop a{" "}
          <span className="font-semibold text-zinc-500">Collection List</span> block and bind its
          fields. Items repeat automatically, live and on published pages.
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((c) => (
            <motion.button
              key={c.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setManagingId(c.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-left shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                <Database size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-zinc-700">{c.name}</span>
                <span className="block text-[10px] text-zinc-400">
                  {c.items.length} {c.items.length === 1 ? "item" : "items"} ·{" "}
                  {c.fields.length} {c.fields.length === 1 ? "field" : "fields"}
                </span>
              </span>
              <Settings2 size={13} className="shrink-0 text-zinc-300 group-hover:text-indigo-500" />
            </motion.button>
          ))}
        </div>
      )}

      {managingId && (
        <CmsManagerModal collectionId={managingId} onClose={() => setManagingId(null)} />
      )}
    </div>
  );
}
