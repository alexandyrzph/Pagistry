import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// One Site row per workspace (header + footer + design-system tokens).
async function getSite(workspaceId: string) {
  // upsert (not find-then-create) to avoid a P2002 race on a fresh workspace's first load
  return prisma.site.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId },
  });
}

function parseJsonArray(json: string | null | undefined): any[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function siteJson(site: { header: string; footer: string; colors: string; textStyles: string }) {
  return {
    header: parseContent(site.header),
    footer: parseContent(site.footer),
    colors: parseJsonArray(site.colors),
    textStyles: parseJsonArray(site.textStyles),
  };
}

// GET /api/site — the active workspace's header/footer + design system
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const site = await getSite(a.workspace.id);
  return NextResponse.json(siteJson(site));
}

// PUT /api/site — update header, footer, and/or design-system tokens (editor+)
export async function PUT(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const data: { header?: string; footer?: string; colors?: string; textStyles?: string } = {};
  if (Array.isArray(body.header)) data.header = JSON.stringify(body.header);
  if (Array.isArray(body.footer)) data.footer = JSON.stringify(body.footer);
  if (Array.isArray(body.colors)) data.colors = JSON.stringify(body.colors);
  if (Array.isArray(body.textStyles)) data.textStyles = JSON.stringify(body.textStyles);
  const site = await prisma.site.upsert({
    where: { workspaceId: a.workspace.id },
    update: data,
    create: { workspaceId: a.workspace.id, ...data },
  });
  return NextResponse.json(siteJson(site));
}
