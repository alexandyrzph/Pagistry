import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";
import { getStripe, appUrl } from "@/lib/commerce/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  return withSiteRole("OWNER", async (ctx) => {
    const stripe = getStripe();
    let store = await prisma.store.upsert({
      where: { siteId: ctx.site.id },
      update: {},
      create: { siteId: ctx.site.id },
    });
    if (!store.stripeAccountId) {
      const account = await stripe.accounts.create({ type: "standard" });
      store = await prisma.store.update({
        where: { siteId: ctx.site.id },
        data: { stripeAccountId: account.id },
      });
    }
    const stripeAccountId = store.stripeAccountId ?? "";
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: appUrl("/store?connect=refresh"),
      return_url: appUrl("/store?connect=return"),
      type: "account_onboarding",
    });
    return json({ url: link.url });
  });
}
