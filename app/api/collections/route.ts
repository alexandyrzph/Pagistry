import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/cms/cms";
import { serializeCollection } from "@/lib/cms/collection-service";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// GET /api/collections — collections in the active workspace
export async function GET() {
  return withWorkspace(async (ws) => {
    const collections = await prisma.collection.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { createdAt: "asc" },
      include: { items: { orderBy: { order: "asc" } } },
    });
    return json(collections.map(serializeCollection));
  });
}

// POST /api/collections — create a collection (editor+)
export async function POST(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "Collection").slice(0, 80);

    const base = slugify(name);
    let slug = base;
    let n = 2;
    while (await prisma.collection.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

    const fields = JSON.stringify([{ key: "title", label: "Title", type: "text" }]);
    const c = await prisma.collection.create({
      data: { name, slug, fields, workspaceId: ws.workspace.id },
      include: { items: true },
    });
    return created(serializeCollection(c));
  });
}
