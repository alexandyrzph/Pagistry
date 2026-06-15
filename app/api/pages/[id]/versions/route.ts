import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/pages/[id]/versions — lightweight list (no content)
export async function GET(_req: Request, { params }: Ctx) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { id } = await params;

  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.pageVersion.findMany({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true },
    take: 100,
  });
  return NextResponse.json(
    versions.map((v) => ({ id: v.id, label: v.label, createdAt: v.createdAt.toISOString() }))
  );
}

// POST /api/pages/[id]/versions — snapshot the page's current content + theme
export async function POST(req: Request, { params }: Ctx) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const { id } = await params;

  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const label = String(body.label || "Manual save").slice(0, 80);

  const version = await prisma.pageVersion.create({
    data: { pageId: id, label, content: page.content, theme: page.theme },
  });

  // keep only the 30 most recent versions per page
  const old = await prisma.pageVersion.findMany({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    skip: 30,
    select: { id: true },
  });
  if (old.length) {
    await prisma.pageVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  return NextResponse.json(
    { id: version.id, label: version.label, createdAt: version.createdAt.toISOString() },
    { status: 201 }
  );
}
