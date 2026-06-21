import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/commerce/stripe";

export async function syncProductToStripe(siteId: string, productId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!store?.stripeAccountId) return;
  const product = await prisma.product.findFirst({
    where: { id: productId, siteId },
    include: { variants: true, images: true },
  });
  if (!product) return;
  const stripe = getStripe();
  const opts = { stripeAccount: store.stripeAccountId };

  const params = {
    name: product.title,
    description: product.description || undefined,
    images: product.images.map((i) => i.url).slice(0, 8),
  };
  const stripeProductId = product.stripeProductId
    ? (await stripe.products.update(product.stripeProductId, params, opts)).id
    : (await stripe.products.create(params, opts)).id;
  if (stripeProductId !== product.stripeProductId) {
    await prisma.product.update({ where: { id: product.id }, data: { stripeProductId } });
  }

  for (const variant of product.variants) {
    const needsPrice = !variant.stripePriceId;
    if (!needsPrice) continue;
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: variant.priceAmount,
        currency: variant.currency,
      },
      opts,
    );
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stripePriceId: price.id },
    });
  }
}
