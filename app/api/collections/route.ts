import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/cms";
import { serializeCollection } from "@/lib/collection-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/collections — collections in the active workspace
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const collections = await prisma.collection.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(collections.map(serializeCollection));
}

// POST /api/collections — create a collection (editor+)
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "Collection").slice(0, 80);

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.collection.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const fields = JSON.stringify([{ key: "title", label: "Title", type: "text" }]);
  const c = await prisma.collection.create({
    data: { name, slug, fields, workspaceId: a.workspace.id },
    include: { items: true },
  });
  return NextResponse.json(serializeCollection(c), { status: 201 });
}
