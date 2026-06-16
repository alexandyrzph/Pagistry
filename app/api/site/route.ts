import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";
import { parseJsonArray } from "@/lib/api/json-parse";

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
  return withWorkspace(async (ws) => {
    const site = await getSite(ws.workspace.id);
    return json(siteJson(site));
  });
}

// PUT /api/site — update header, footer, and/or design-system tokens (editor+)
export async function PUT(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const data: { header?: string; footer?: string; colors?: string; textStyles?: string } = {};
    if (Array.isArray(body.header)) data.header = JSON.stringify(body.header);
    if (Array.isArray(body.footer)) data.footer = JSON.stringify(body.footer);
    if (Array.isArray(body.colors)) data.colors = JSON.stringify(body.colors);
    if (Array.isArray(body.textStyles)) data.textStyles = JSON.stringify(body.textStyles);
    const site = await prisma.site.upsert({
      where: { workspaceId: ws.workspace.id },
      update: data,
      create: { workspaceId: ws.workspace.id, ...data },
    });
    return json(siteJson(site));
  });
}
