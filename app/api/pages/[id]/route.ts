import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/pages/:id
export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();
    return json(page);
  });
}

// PUT /api/pages/:id — update title and/or content
export async function PUT(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: {
      title?: string;
      content?: string;
      theme?: string;
      metaTitle?: string | null;
      metaDescription?: string | null;
      ogImage?: string | null;
    } = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 120);
    if (body.content !== undefined) data.content = JSON.stringify(body.content);
    if (body.theme !== undefined) data.theme = JSON.stringify(body.theme);
    if (body.seo) {
      if (body.seo.metaTitle !== undefined) data.metaTitle = body.seo.metaTitle || null;
      if (body.seo.metaDescription !== undefined) data.metaDescription = body.seo.metaDescription || null;
      if (body.seo.ogImage !== undefined) data.ogImage = body.seo.ogImage || null;
    }
    const result = await prisma.page.updateMany({ where: { id, workspaceId: ws.workspace.id }, data });
    if (result.count === 0) return notFound();
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    return json(page);
  });
}

// DELETE /api/pages/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.page.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
