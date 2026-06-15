import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeItem } from "@/lib/collection-service";
import { requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id, itemId } = await params;

  const collection = await prisma.collection.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { data?: string; order?: number } = {};
  if (body.data && typeof body.data === "object") data.data = JSON.stringify(body.data);
  if (typeof body.order === "number") data.order = body.order;

  const result = await prisma.collectionItem.updateMany({ where: { id: itemId, collectionId: id }, data });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const item = await prisma.collectionItem.findFirst({ where: { id: itemId, collectionId: id } });
  return NextResponse.json(serializeItem(item!));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id, itemId } = await params;

  const collection = await prisma.collection.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.collectionItem.deleteMany({ where: { id: itemId, collectionId: id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
