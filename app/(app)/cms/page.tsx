import Link from "next/link";
import { Database, LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { NewCollectionButton } from "@/components/app-shell/cms/NewCollectionButton";

export const dynamic = "force-dynamic";

export default async function CmsPage() {
  const { workspace } = await requireWorkspace();
  const collections = await prisma.collection.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">CMS</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Collections power dynamic content. Each collection has typed fields and a template for its detail pages.
          </p>
        </div>
        <NewCollectionButton />
      </div>

      <div className="mt-8">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <Database size={24} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">No collections yet.</p>
            <p className="text-xs text-zinc-400">
              Create a collection to start managing dynamic content.
            </p>
            <div className="mt-3">
              <NewCollectionButton />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/cms/${col.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 group-hover:bg-indigo-50 transition-colors">
                  <LayoutGrid size={16} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-800">{col.name}</p>
                  <p className="text-xs text-zinc-400">/{col.slug}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">{col._count.items} item{col._count.items !== 1 ? "s" : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
