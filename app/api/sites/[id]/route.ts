import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRole("ADMIN", async (ws) => {
    const site = await prisma.site.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!site) return notFound();
    const body = await req.json().catch(() => ({}));
    const updated = await prisma.site.update({
      where: { id },
      data: { name: String(body?.name ?? site.name).slice(0, 80) },
    });
    return json(updated);
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRole("ADMIN", async (ws) => {
    const site = await prisma.site.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!site) return notFound();
    await prisma.site.delete({ where: { id } });
    return json({ ok: true });
  });
}
