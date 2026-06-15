"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useEditorActions } from "./editor-actions";

type PageRow = { id: string; title: string; slug: string; published: boolean };

export function PagesPanel() {
  const actions = useEditorActions();
  const currentId = useEditor((s) => s.pageId);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function load() {
    fetch("/api/pages")
      .then((r) => r.json())
      .then((d) => setPages(Array.isArray(d) ? d : []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function create() {
    actions.confirmLeave(async () => {
      setCreating(true);
      try {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Untitled Page", content: [] }),
        });
        const p = await res.json();
        await actions.loadPageInPlace(p.id);
        load();
      } finally {
        setCreating(false);
      }
    });
  }

  return (
    <div className="space-y-1">
      <button
        onClick={create}
        disabled={creating}
        className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} New page
      </button>

      {loading ? (
        <div className="flex justify-center py-6 text-zinc-400">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        pages.map((p) => (
          <button
            key={p.id}
            onClick={() => actions.switchPage(p.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
              p.id === currentId ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100"
            )}
          >
            <FileText size={14} className="shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            {p.published && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
          </button>
        ))
      )}
    </div>
  );
}
