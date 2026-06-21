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
    const explicitHandle = typeof body?.handle === "string" && body.handle.trim().length > 0;
    const base = slugify(explicitHandle ? String(body.handle) : title).slice(0, 80);
    if (!base) return badRequest("Invalid handle");

    let handle = base;
    if (explicitHandle) {
      const existing = await prisma.product.findUnique({
        where: { siteId_handle: { siteId: ctx.site.id, handle } },
      });
      if (existing) return json({ error: "That handle is already in use" }, 409);
    } else {
      let n = 1;
      while (
        await prisma.product.findUnique({
          where: { siteId_handle: { siteId: ctx.site.id, handle } },
        })
      ) {
        n += 1;
        handle = `${base}-${n}`.slice(0, 80);
      }
    }
    const description = typeof body?.description === "string" ? body.description : "";
    const status = typeof body?.status === "string" ? body.status : "draft";
    const v0 = Array.isArray(body?.variants) ? body.variants[0] : undefined;
    const priceAmount = typeof v0?.priceAmount === "number" ? Math.round(v0.priceAmount) : 0;
    const inventory = typeof v0?.inventory === "number" ? Math.round(v0.inventory) : 0;
    const rawImages = Array.isArray(body?.images) ? body.images : [];
    const imageData = rawImages
      .filter((im: { url?: unknown }) => typeof im?.url === "string" && im.url.length > 0)
      .map((im: { url: string; alt?: string }, idx: number) => ({
        url: im.url,
        alt: typeof im.alt === "string" ? im.alt : "",
        position: idx,
      }));

    const product = await prisma.product.create({
      data: {
        siteId: ctx.site.id,
        handle,
        title,
        description,
        status,
        variants: { create: { siteId: ctx.site.id, title: "Default", priceAmount, inventory } },
        images: { create: imageData },
      },
      include: { variants: true, images: true },
    });
    await syncProductToStripe(ctx.site.id, product.id).catch(() => {});
    return created({ product });
  });
}
