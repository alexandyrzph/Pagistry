import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function safeParse(s: string) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { id } = await params;
  const c = await prisma.component.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: c.id, name: c.name, content: safeParse(c.content) });
}

export async function PUT(req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; content?: string } = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 80);
  if (body.content !== undefined) data.content = JSON.stringify(body.content);
  const result = await prisma.component.updateMany({ where: { id, workspaceId: a.workspace.id }, data });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await prisma.component.findFirst({ where: { id, workspaceId: a.workspace.id } });
  return NextResponse.json({ id: c!.id, name: c!.name, content: safeParse(c!.content) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;
  const result = await prisma.component.deleteMany({ where: { id, workspaceId: a.workspace.id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
