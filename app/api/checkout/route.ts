import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound } from "@/lib/api/api-response";
import { getStripe, appUrl } from "@/lib/commerce/stripe";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!store?.stripeAccountId || !store.chargesEnabled)
    return badRequest("Store not ready for checkout");
  const cart = await getCart(siteId);
  if (!cart || cart.items.length === 0) return badRequest("Cart is empty");

  const line_items: { price: string; quantity: number }[] = [];
  for (const item of cart.items) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: item.variantId, siteId },
    });
    if (!variant?.stripePriceId) return badRequest("A product is not purchasable yet");
    line_items.push({ price: variant.stripePriceId, quantity: item.quantity });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items,
      automatic_tax: { enabled: store.taxEnabled },
      allow_promotion_codes: true,
      success_url: appUrl(`${store.successPath}?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: appUrl(store.cancelPath),
      customer_creation: "always",
      metadata: { cartId: cart.id, siteId },
    },
    {
      stripeAccount: store.stripeAccountId,
      idempotencyKey: `checkout_${cart.id}_${cart.items.length}`,
    },
  );
  await prisma.cart.update({
    where: { id: cart.id },
    data: { stripeCheckoutSessionId: session.id },
  });
  return json({ url: session.url });
}
