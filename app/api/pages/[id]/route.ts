import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";
import { instrumentApi, timeDb } from "@/lib/observability";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/pages/:id
export async function GET(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withWorkspace(async (ws) => {
      const { id } = await params;
      const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
      if (!page) return notFound();
      return json(page);
    }),
  );
}

// PUT /api/pages/:id — update title and/or content
export async function PUT(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withRole("EDITOR", async (ws) => {
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
    const result = await timeDb("page.updateMany", () =>
      prisma.page.updateMany({ where: { id, workspaceId: ws.workspace.id }, data }),
    );
    if (result.count === 0) return notFound();
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    return json(page);
    }),
  );
}

// DELETE /api/pages/:id
export async function DELETE(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.page.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    // best-effort: remove the cached preview screenshot
    await unlink(path.join(process.cwd(), "public", "uploads", "thumbnails", `${id}.png`)).catch(() => {});
    return json({ ok: true });
    }),
  );
}
