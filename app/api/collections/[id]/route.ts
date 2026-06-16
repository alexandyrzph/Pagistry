import { prisma } from "@/lib/prisma";
import { serializeCollection } from "@/lib/cms/collection-service";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;
    const collection = await prisma.collection.findFirst({
      where: { id, workspaceId: ws.workspace.id },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!collection) return notFound();
    return json(serializeCollection(collection));
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: { name?: string; fields?: string; detailTemplate?: string; detailEnabled?: boolean } = {};
    if (typeof body.name === "string") data.name = body.name.slice(0, 80);
    if (Array.isArray(body.fields)) data.fields = JSON.stringify(body.fields);
    if (Array.isArray(body.detailTemplate)) data.detailTemplate = JSON.stringify(body.detailTemplate);
    if (typeof body.detailEnabled === "boolean") data.detailEnabled = body.detailEnabled;
    const result = await prisma.collection.updateMany({ where: { id, workspaceId: ws.workspace.id }, data });
    if (result.count === 0) return notFound();
    const collection = await prisma.collection.findFirst({
      where: { id, workspaceId: ws.workspace.id },
      include: { items: { orderBy: { order: "asc" } } },
    });
    return json(serializeCollection(collection!));
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.collection.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
