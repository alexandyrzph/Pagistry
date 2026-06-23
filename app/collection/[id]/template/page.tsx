import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireSite } from "@/lib/auth/site";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function CollectionTemplateEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSite();
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, siteId: ctx.site.id },
  });
  if (!collection) notFound();

  return (
    <EditorClient
      mode="collection"
      page={{
        id: collection.id,
        title: `${collection.name} detail`,
        slug: "",
        published: false,
        content: parseContent(collection.detailTemplate),
        seo: {},
        theme: {},
      }}
    />
  );
}
