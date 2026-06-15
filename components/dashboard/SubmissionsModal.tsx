"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Inbox, Loader2, X } from "lucide-react";

type Submission = {
  id: string;
  formId: string;
  data: Record<string, string>;
  createdAt: string;
};

export function SubmissionsModal({
  page,
  onClose,
}: {
  page: { id: string; title: string } | null;
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!page) return;
    setLoading(true);
    fetch(`/api/submissions?pageId=${page.id}`)
      .then((r) => r.json())
      .then((d) => setSubs(Array.isArray(d) ? d : []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [page]);

  const columns = Array.from(new Set(subs.flatMap((s) => Object.keys(s.data))));

  function exportCsv() {
    const headers = ["Submitted", ...columns];
    const rows = subs.map((s) => [
      new Date(s.createdAt).toLocaleString(),
      ...columns.map((c) => s.data[c] ?? ""),
    ]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${page?.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      {page && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-900">Submissions</h2>
                <p className="text-xs text-zinc-400">
                  {page.title} · {subs.length} {subs.length === 1 ? "entry" : "entries"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {subs.length > 0 && (
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    <Download size={13} /> CSV
                  </button>
                )}
                <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-zinc-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : subs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-sm text-zinc-400">
                  <div className="rounded-2xl bg-zinc-100 p-3.5">
                    <Inbox size={22} className="text-zinc-400" />
                  </div>
                  No submissions yet. Publish a page with a Form block and entries will appear here.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Submitted</th>
                      {columns.map((c) => (
                        <th key={c} className="px-4 py-2.5 font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => (
                      <tr key={s.id} className="border-t border-zinc-100 align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                        {columns.map((c) => (
                          <td key={c} className="px-4 py-2.5 text-zinc-700">{s.data[c] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
