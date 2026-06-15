"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, RotateCcw, Save, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";

type Version = { id: string; label: string; createdAt: string };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export function VersionHistory({
  open,
  onClose,
  pageId,
  save,
}: {
  open: boolean;
  onClose: () => void;
  pageId: string | null;
  save: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const replaceTree = useEditor((s) => s.replaceTree);
  const setTheme = useEditor((s) => s.setTheme);

  const refresh = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/pages/${pageId}/versions`);
      setVersions(await r.json());
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const snapshot = async () => {
    if (!pageId) return;
    setBusy("save");
    try {
      await save(); // persist current edits so the snapshot is current
      await fetch(`/api/pages/${pageId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Manual save" }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const restore = async (v: Version) => {
    if (!pageId) return;
    setBusy(v.id);
    try {
      // snapshot the current state first so restore is always reversible
      await save();
      await fetch(`/api/pages/${pageId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Before restore" }),
      });
      const snap = await (await fetch(`/api/pages/${pageId}/versions/${v.id}`)).json();
      replaceTree(snap.content);
      setTheme(snap.theme ?? {});
      await save();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!pageId) return;
    setBusy(id);
    try {
      await fetch(`/api/pages/${pageId}/versions/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-200 px-5 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <History size={16} />
              </div>
              <h2 className="flex-1 text-sm font-bold tracking-tight text-zinc-900">Version history</h2>
              <button
                onClick={snapshot}
                disabled={busy === "save"}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save version
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="pc-skeleton h-12 rounded-lg" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-zinc-400">
                  No versions yet. Click <span className="font-medium text-zinc-500">Save version</span> to capture
                  a restore point — one is also saved each time you publish.
                </p>
              ) : (
                <div className="space-y-1">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-50"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          v.label === "Published" ? "bg-emerald-500" : v.label === "Before restore" ? "bg-amber-400" : "bg-indigo-400"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-700">{v.label}</span>
                        <span className="block text-[11px] text-zinc-400">{relativeTime(v.createdAt)}</span>
                      </span>
                      <button
                        onClick={() => restore(v)}
                        disabled={!!busy}
                        title="Restore this version"
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 opacity-0 transition hover:bg-indigo-50 group-hover:opacity-100 disabled:opacity-40"
                      >
                        {busy === v.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Restore
                      </button>
                      <button
                        onClick={() => remove(v.id)}
                        disabled={!!busy}
                        title="Delete version"
                        className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
