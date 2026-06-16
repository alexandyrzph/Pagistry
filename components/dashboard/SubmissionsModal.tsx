"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Inbox, Loader2, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";

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

  // Retain the last page so the header stays populated through the exit animation.
  const lastPageRef = useRef(page);
  if (page) lastPageRef.current = page;
  const view = page ?? lastPageRef.current;

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
    <Modal open={!!page} onClose={onClose} className="flex max-h-[80vh] max-w-3xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-900">Submissions</h2>
                <p className="text-xs text-zinc-400">
                  {view?.title} · {subs.length} {subs.length === 1 ? "entry" : "entries"}
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
                <Table>
                  <THead className="sticky top-0 bg-zinc-50">
                    <tr>
                      <TH>Submitted</TH>
                      {columns.map((c) => (
                        <TH key={c}>{c}</TH>
                      ))}
                    </tr>
                  </THead>
                  <TBody>
                    {subs.map((s) => (
                      <TR key={s.id} className="align-top">
                        <TD className="whitespace-nowrap text-zinc-400">
                          {new Date(s.createdAt).toLocaleString()}
                        </TD>
                        {columns.map((c) => (
                          <TD key={c} className="text-zinc-700">{s.data[c] ?? ""}</TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
    </Modal>
  );
}
