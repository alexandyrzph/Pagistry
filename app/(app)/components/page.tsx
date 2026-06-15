import Link from "next/link";
import { Component } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const { workspace } = await requireWorkspace();
  const components = await prisma.component.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Components</h1>
      <p className="mt-1 text-sm text-zinc-500">Reusable sections you've saved from the editor.</p>

      <div className="mt-8">
        {components.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <Component size={24} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">No components yet.</p>
            <p className="text-xs text-zinc-400">
              Save any section as a reusable component from the editor.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => (
              <Link
                key={c.id}
                href={`/component/${c.id}`}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 group-hover:bg-indigo-50 transition-colors">
                  <Component size={20} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="truncate text-sm font-semibold text-zinc-800">{c.name}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Updated {new Date(c.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
