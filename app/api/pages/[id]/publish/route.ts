import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/pages/:id/publish — set published state (defaults to true)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const published = body.published !== false;

  const result = await prisma.page.updateMany({ where: { id, workspaceId: a.workspace.id }, data: { published } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  await logActivity(a.workspace.id, a.user.id, "page.published", id);
  return NextResponse.json({ published, slug: page?.slug });
}
