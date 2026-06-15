import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeCollection } from "@/lib/collection-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, workspaceId: a.workspace.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCollection(collection));
}

export async function PUT(req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; fields?: string; detailTemplate?: string; detailEnabled?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 80);
  if (Array.isArray(body.fields)) data.fields = JSON.stringify(body.fields);
  if (Array.isArray(body.detailTemplate)) data.detailTemplate = JSON.stringify(body.detailTemplate);
  if (typeof body.detailEnabled === "boolean") data.detailEnabled = body.detailEnabled;
  const result = await prisma.collection.updateMany({ where: { id, workspaceId: a.workspace.id }, data });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const collection = await prisma.collection.findFirst({
    where: { id, workspaceId: a.workspace.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(serializeCollection(collection!));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;
  const result = await prisma.collection.deleteMany({ where: { id, workspaceId: a.workspace.id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
