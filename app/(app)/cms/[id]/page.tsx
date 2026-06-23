import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSite } from "@/lib/auth/site";
import { serializeCollection } from "@/lib/cms/collection-service";
import { CollectionManager } from "@/components/app-shell/cms/CollectionManager";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSite();
  const row = await prisma.collection.findFirst({
    where: { id, siteId: ctx.site.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!row) notFound();
  return <CollectionManager initial={serializeCollection(row)} />;
}
