import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { parseTheme } from "@/lib/design/theme";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

// GET — full snapshot (content + theme) for preview / restore
export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id, versionId } = await params;

    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();

    const v = await prisma.pageVersion.findFirst({ where: { id: versionId, pageId: id } });
    if (!v) return notFound();
    return json({
      id: v.id,
      label: v.label,
      createdAt: v.createdAt.toISOString(),
      content: parseContent(v.content),
      theme: parseTheme(v.theme),
    });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id, versionId } = await params;

    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();

    const result = await prisma.pageVersion.deleteMany({ where: { id: versionId, pageId: id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
