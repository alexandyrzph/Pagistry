import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireUser } from "@/lib/auth/auth";
import { requireWorkspace } from "@/lib/auth/workspace";
import { EditorClient } from "@/components/editor/EditorClient";

export const dynamic = "force-dynamic";

export default async function SiteRegionEditor({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  await requireUser();
  const { workspace } = await requireWorkspace();
  const { region } = await params;
  if (region !== "header" && region !== "footer") notFound();

  const site = await prisma.site.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: { workspaceId: workspace.id },
  });
  const content = parseContent(region === "footer" ? site.footer : site.header);

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
