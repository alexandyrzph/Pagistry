import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireSite } from "@/lib/auth/site";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function SiteRegionEditor({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const ctx = await requireSite();
  const { region } = await params;
  if (region !== "header" && region !== "footer") notFound();

  const site = await prisma.site.findFirst({ where: { id: ctx.site.id } });
  const content = parseContent(site ? (region === "footer" ? site.footer : site.header) : "[]");

  return (
    <EditorClient
      mode="site"
      siteRegion={region}
      page={{
        id: "site",
        title: region === "footer" ? "Footer" : "Header",
        slug: "",
        published: false,
        content,
        seo: {},
        theme: {},
      }}
    />
  );
}
