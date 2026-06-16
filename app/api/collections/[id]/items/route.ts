import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/cms/collection-service";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/collections/[id]/items — list items for a collection
export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;

    const collection = await prisma.collection.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!collection) return notFound();

    const items = await prisma.collectionItem.findMany({
      where: { collectionId: id },
      orderBy: { order: "asc" },
    });
    return json(items.map(serializeItem));
  });
}

// POST /api/collections/[id]/items — append a new item
export async function POST(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;

    const collection = await prisma.collection.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!collection) return notFound();

    const body = await req.json().catch(() => ({}));
    const data =
      body.data && typeof body.data === "object" ? JSON.stringify(body.data) : "{}";

    const last = await prisma.collectionItem.findFirst({
      where: { collectionId: id },
      orderBy: { order: "desc" },
    });
    const order = (last?.order ?? -1) + 1;

    const item = await prisma.collectionItem.create({
      data: { collectionId: id, data, order },
    });
    return created(serializeItem(item));
  });
}
