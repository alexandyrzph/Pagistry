import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";
import { syncProductToStripe } from "@/lib/commerce/sync";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSite(async (ctx) => {
    const product = await prisma.product.findFirst({
      where: { id, siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    });
    if (!product) return notFound();
    return json({ product });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("EDITOR", async (ctx) => {
    const product = await prisma.product.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!product) return notFound();
    const body = await req.json().catch(() => ({}));

    const data: Record<string, unknown> = {};
    if (typeof body?.title === "string") data.title = body.title;
    if (typeof body?.description === "string") data.description = body.description;
    if (typeof body?.status === "string") data.status = body.status;
    if (typeof body?.data === "string") data.data = body.data;
    if (Object.keys(data).length) await prisma.product.update({ where: { id }, data });

    if (Array.isArray(body?.variants)) {
      for (const v of body.variants) {
        if (typeof v?.id !== "string") continue;
        const priceChanged = typeof v?.priceAmount === "number";
        await prisma.productVariant.updateMany({
          where: { id: v.id, siteId: ctx.site.id },
          data: {
            ...(typeof v.title === "string" ? { title: v.title } : {}),
            ...(typeof v.options === "string" ? { options: v.options } : {}),
            ...(typeof v.sku === "string" ? { sku: v.sku } : {}),
            ...(typeof v.priceAmount === "number" ? { priceAmount: v.priceAmount } : {}),
            ...(typeof v.inventory === "number" ? { inventory: v.inventory } : {}),
            ...(typeof v.inventoryPolicy === "string"
              ? { inventoryPolicy: v.inventoryPolicy }
              : {}),
            ...(priceChanged ? { stripePriceId: null } : {}),
          },
        });
      }
    }

    if (Array.isArray(body?.images)) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      await prisma.productImage.createMany({
        data: body.images
          .filter((im: { url?: unknown }) => typeof im?.url === "string")
          .map((im: { url: string; alt?: string }, idx: number) => ({
            productId: id,
            url: im.url,
            alt: typeof im.alt === "string" ? im.alt : "",
            position: idx,
          })),
      });
    }

    await syncProductToStripe(ctx.site.id, id).catch(() => {});
    const updated = await prisma.product.findFirst({
      where: { id, siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    });
    return json({ product: updated });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("EDITOR", async (ctx) => {
    const product = await prisma.product.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!product) return notFound();
    await prisma.product.delete({ where: { id } });
    return json({ ok: true });
  });
}
