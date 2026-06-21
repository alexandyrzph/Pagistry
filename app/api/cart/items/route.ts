import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getOrCreateCart } from "@/lib/commerce/cart-cookie";
import { clampQuantity } from "@/lib/commerce/cart";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const body = await req.json().catch(() => ({}));
  const variantId = String(body?.variantId ?? "");
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, siteId } });
  if (!variant) return badRequest("Unknown variant");

  const cart = await getOrCreateCart(siteId);
  if (!cart) return badRequest("No cart");
  const requested = Number(body?.quantity ?? 1);
  const existing = cart.items.find((i) => i.variantId === variantId);
  const desired = (existing?.quantity ?? 0) + requested;
  const qty = clampQuantity(desired, variant.inventory, variant.inventoryPolicy);

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: qty, unitAmount: variant.priceAmount },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity: qty, unitAmount: variant.priceAmount },
    });
  }
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}
