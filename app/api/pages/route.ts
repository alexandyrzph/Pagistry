import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/page-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/pages — list pages in the active workspace (newest first)
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const pages = await prisma.page.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(pages);
}

// POST /api/pages — create a page in the active workspace (editor+)
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const title = (body.title || "Untitled Page").toString().slice(0, 120);
  const slug = await uniqueSlug(title);
  const content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
  const page = await prisma.page.create({
    data: { title, slug, content, workspaceId: a.workspace.id },
  });
  await logActivity(a.workspace.id, a.user.id, "page.created", page.id, { title });
  return NextResponse.json(page, { status: 201 });
}
