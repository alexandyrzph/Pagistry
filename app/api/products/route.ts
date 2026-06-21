import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, created, badRequest } from "@/lib/api/api-response";
import { slugify } from "@/lib/utils";
import { syncProductToStripe } from "@/lib/commerce/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const products = await prisma.product.findMany({
      where: { siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ products });
  });
}

export async function POST(req: Request) {
  return withSiteRole("EDITOR", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim() || "Untitled product";
    const handle = slugify(String(body?.handle ?? title)).slice(0, 80);
    if (!handle) return badRequest("Invalid handle");
    const existing = await prisma.product.findUnique({
      where: { siteId_handle: { siteId: ctx.site.id, handle } },
    });
    if (existing) return json({ error: "That handle is already in use" }, 409);
    const product = await prisma.product.create({
      data: {
        siteId: ctx.site.id,
        handle,
        title,
        variants: { create: { siteId: ctx.site.id, title: "Default" } },
      },
      include: { variants: true, images: true },
    });
    await syncProductToStripe(ctx.site.id, product.id).catch(() => {});
    return created({ product });
  });
}
