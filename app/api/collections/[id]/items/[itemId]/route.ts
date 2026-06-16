import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/cms/collection-service";
import { withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id, itemId } = await params;

    const collection = await prisma.collection.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!collection) return notFound();

    const body = await req.json().catch(() => ({}));
    const data: { data?: string; order?: number } = {};
    if (body.data && typeof body.data === "object") data.data = JSON.stringify(body.data);
    if (typeof body.order === "number") data.order = body.order;

    const result = await prisma.collectionItem.updateMany({ where: { id: itemId, collectionId: id }, data });
    if (result.count === 0) return notFound();
    const item = await prisma.collectionItem.findFirst({ where: { id: itemId, collectionId: id } });
    return json(serializeItem(item!));
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id, itemId } = await params;

    const collection = await prisma.collection.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!collection) return notFound();

    const result = await prisma.collectionItem.deleteMany({ where: { id: itemId, collectionId: id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
