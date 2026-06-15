"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { SubmissionsModal } from "@/components/dashboard/SubmissionsModal";

type PageDto = { id: string; title: string; count: number };

export function FormsClient({ pages }: { pages: PageDto[] }) {
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);

  const hasAny = pages.some((p) => p.count > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Forms</h1>
      <p className="mt-1 text-sm text-zinc-500">View and export form submissions from your published pages.</p>

      <div className="mt-8">
        {!hasAny ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <Inbox size={24} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">No form submissions yet.</p>
            <p className="text-xs text-zinc-400">
              Add a Form block to a page, publish it, and entries will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {pages
              .filter((p) => p.count > 0)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected({ id: p.id, title: p.title })}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800">{p.title}</p>
                  </div>
                  <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-semibold text-indigo-700">
                    {p.count}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      <SubmissionsModal page={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
