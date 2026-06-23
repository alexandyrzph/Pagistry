import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireSite } from "@/lib/auth/site";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSite();
  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id, siteId: ctx.site.id } });
  if (!page) notFound();

  let theme = {};
  try {
    theme = JSON.parse(page.theme || "{}");
  } catch {
    theme = {};
  }

  return (
    <EditorClient
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        published: page.published,
        content: parseContent(page.content),
        seo: {
          metaTitle: page.metaTitle ?? "",
          metaDescription: page.metaDescription ?? "",
          ogImage: page.ogImage ?? "",
        },
        theme,
      }}
    />
  );
}
