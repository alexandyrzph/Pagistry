import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireSite } from "@/lib/auth/site";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function ComponentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSite();
  const { id } = await params;
  const comp = await prisma.component.findFirst({ where: { id, siteId: ctx.site.id } });
  if (!comp) notFound();

  return (
    <EditorClient
      mode="component"
      page={{
        id: comp.id,
        title: comp.name,
        slug: "",
        published: false,
        content: parseContent(comp.content),
        seo: {},
        theme: {},
      }}
    />
  );
}
