import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, badRequest, forbidden } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// PATCH /api/workspaces/[id] — rename (admin+, must be the active workspace)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRole("ADMIN", async (ws) => {
    const { id } = await params;
    if (ws.workspace.id !== id) return forbidden();
    const body = await req.json().catch(() => ({}));
    const data: { name?: string } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
    if (!Object.keys(data).length) return badRequest("Nothing to update");
    const workspace = await prisma.workspace.update({ where: { id }, data });
    return json({ id: workspace.id, name: workspace.name, slug: workspace.slug });
  });
}

// DELETE /api/workspaces/[id] — delete the workspace (owner only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRole("OWNER", async (ws) => {
    const { id } = await params;
    if (ws.workspace.id !== id) return forbidden();
    // refuse to delete the user's only workspace
    const count = await prisma.membership.count({ where: { userId: ws.user.id } });
    if (count <= 1) return badRequest("Cannot delete your only workspace");
    await prisma.workspace.delete({ where: { id } });
    return json({ ok: true });
  });
}
