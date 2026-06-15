import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// PATCH /api/workspaces/[id] — rename (admin+, must be the active workspace)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  if (a.workspace.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const ws = await prisma.workspace.update({ where: { id }, data });
  return NextResponse.json({ id: ws.id, name: ws.name, slug: ws.slug });
}

// DELETE /api/workspaces/[id] — delete the workspace (owner only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await requireApiRole("OWNER");
  if ("response" in a) return a.response;
  if (a.workspace.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // refuse to delete the user's only workspace
  const count = await prisma.membership.count({ where: { userId: a.user.id } });
  if (count <= 1) return NextResponse.json({ error: "Cannot delete your only workspace" }, { status: 400 });
  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
