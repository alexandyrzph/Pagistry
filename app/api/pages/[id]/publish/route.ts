import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/pages/:id/publish — set published state (defaults to true)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const published = body.published !== false;

    const result = await prisma.page.updateMany({ where: { id, workspaceId: ws.workspace.id }, data: { published } });
    if (result.count === 0) return notFound();
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    await logActivity(ws.workspace.id, ws.user.id, "page.published", id);
    return json({ published, slug: page?.slug });
  });
}
