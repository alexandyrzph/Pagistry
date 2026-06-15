import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { parseTheme } from "@/lib/theme";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

// GET — full snapshot (content + theme) for preview / restore
export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { id, versionId } = await params;

  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const v = await prisma.pageVersion.findFirst({ where: { id: versionId, pageId: id } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: v.id,
    label: v.label,
    createdAt: v.createdAt.toISOString(),
    content: parseContent(v.content),
    theme: parseTheme(v.theme),
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id, versionId } = await params;

  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.pageVersion.deleteMany({ where: { id: versionId, pageId: id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
