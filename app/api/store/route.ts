import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const store = await prisma.store.findUnique({ where: { siteId: ctx.site.id } });
    return json({ store });
  });
}

export async function PATCH(req: Request) {
  return withSiteRole("ADMIN", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body?.currency === "string") data.currency = body.currency.toLowerCase();
    if (typeof body?.taxEnabled === "boolean") data.taxEnabled = body.taxEnabled;
    if (typeof body?.shippingMode === "string") data.shippingMode = body.shippingMode;
    if (typeof body?.productTemplate === "string") data.productTemplate = body.productTemplate;
    const store = await prisma.store.upsert({
      where: { siteId: ctx.site.id },
      update: data,
      create: { siteId: ctx.site.id, ...data },
    });
    return json({ store });
  });
}
