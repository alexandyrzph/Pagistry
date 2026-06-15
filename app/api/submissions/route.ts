import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// POST /api/submissions — public form submission { slug, formId, data }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || "");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.submission.create({
    data: {
      pageId: page.id,
      formId: String(body.formId || "form"),
      data: JSON.stringify(body.data ?? {}),
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/submissions?pageId=... — list submissions for a page (inbox, workspace-scoped)
export async function GET(req: Request) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const page = await prisma.page.findFirst({ where: { id: pageId, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subs = await prisma.submission.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    subs.map((s) => ({
      id: s.id,
      formId: s.formId,
      data: safeParse(s.data),
      createdAt: s.createdAt.toISOString(),
    }))
  );
}

function safeParse(s: string): Record<string, string> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
