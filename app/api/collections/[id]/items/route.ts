import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/collection-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/collections/[id]/items — list items for a collection
export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { id } = await params;

  const collection = await prisma.collection.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await prisma.collectionItem.findMany({
    where: { collectionId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(items.map(serializeItem));
}

// POST /api/collections/[id]/items — append a new item
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;

  const collection = await prisma.collection.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  return NextResponse.json(serializeItem(item), { status: 201 });
}
