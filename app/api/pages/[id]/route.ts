import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { badRequest, json, notFound } from "@/lib/api/api-response";
import { instrumentApi, timeDb } from "@/lib/observability";
import { deleteFile } from "@/lib/storage";
import { validatePageSlug } from "@/lib/pages/validate-slug";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withSite(async (ctx) => {
      const { id } = await params;
      const page = await prisma.page.findFirst({ where: { id, siteId: ctx.site.id } });
      if (!page) return notFound();
      return json(page);
    }),
  );
}

export async function PUT(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withSiteRole("EDITOR", async (ctx) => {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const data: {
        title?: string;
        content?: string;
        theme?: string;
        metaTitle?: string | null;
        metaDescription?: string | null;
        ogImage?: string | null;
        slug?: string;
        noindex?: boolean;
      } = {};
      if (typeof body.title === "string") data.title = body.title.slice(0, 120);
      if (body.content !== undefined) data.content = JSON.stringify(body.content);
      if (body.theme !== undefined) data.theme = JSON.stringify(body.theme);
      if (body.seo) {
        if (body.seo.metaTitle !== undefined) data.metaTitle = body.seo.metaTitle || null;
        if (body.seo.metaDescription !== undefined)
          data.metaDescription = body.seo.metaDescription || null;
        if (body.seo.ogImage !== undefined) data.ogImage = body.seo.ogImage || null;
      }
      if (typeof body.noindex === "boolean") data.noindex = body.noindex;
      if (typeof body.slug === "string") {
        try {
          data.slug = await validatePageSlug(prisma, ctx.site.id, id, body.slug);
        } catch (e) {
          return badRequest(
            e instanceof Error && e.message === "slug_taken"
              ? "That slug is already used by another page"
              : "Slug cannot be empty",
          );
        }
      }
      const result = await timeDb("page.updateMany", () =>
        prisma.page.updateMany({ where: { id, siteId: ctx.site.id }, data }),
      );
      if (result.count === 0) return notFound();
      const page = await prisma.page.findFirst({ where: { id, siteId: ctx.site.id } });
      return json(page);
    }),
  );
}

export async function DELETE(req: Request, { params }: Ctx) {
  return instrumentApi("/api/pages/:id", req, () =>
    withSiteRole("EDITOR", async (ctx) => {
      const { id } = await params;
      const result = await prisma.page.deleteMany({ where: { id, siteId: ctx.site.id } });
      if (result.count === 0) return notFound();
      await deleteFile(`thumbnails/${id}.png`);
      return json({ ok: true });
    }),
  );
}
