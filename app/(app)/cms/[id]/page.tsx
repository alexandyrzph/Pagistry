import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { serializeCollection } from "@/lib/collection-service";
import { CollectionManager } from "@/components/app-shell/cms/CollectionManager";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const row = await prisma.collection.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!row) notFound();
  return <CollectionManager initial={serializeCollection(row)} />;
}
