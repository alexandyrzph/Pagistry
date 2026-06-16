import { prisma } from "@/lib/prisma";
import { withWorkspace } from "@/lib/api/api-handler";
import { json, created, badRequest, notFound } from "@/lib/api/api-response";
import { parseJsonObject } from "@/lib/api/json-parse";

export const dynamic = "force-dynamic";

// POST /api/submissions — public form submission { slug, formId, data }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || "");
  if (!slug) return badRequest("slug required");

  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return notFound("Not found");

  await prisma.submission.create({
    data: {
      pageId: page.id,
      formId: String(body.formId || "form"),
      data: JSON.stringify(body.data ?? {}),
    },
  });
  return created({ ok: true });
}

// GET /api/submissions?pageId=... — list submissions for a page (inbox, workspace-scoped)
export async function GET(req: Request) {
  return withWorkspace(async (ws) => {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get("pageId");
    if (!pageId) return badRequest("pageId required");

    const page = await prisma.page.findFirst({ where: { id: pageId, workspaceId: ws.workspace.id } });
    if (!page) return notFound("Not found");

    const subs = await prisma.submission.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
    });

    return json(
      subs.map((s) => ({
        id: s.id,
        formId: s.formId,
        data: parseJsonObject(s.data),
        createdAt: s.createdAt.toISOString(),
      }))
    );
  });
}
