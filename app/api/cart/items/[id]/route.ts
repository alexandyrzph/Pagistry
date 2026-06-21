import { prisma } from "@/lib/prisma";
import { json, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";
import { clampQuantity } from "@/lib/commerce/cart";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  const item = cart?.items.find((i) => i.id === id);
  if (!cart || !item) return notFound();
  const variant = await prisma.productVariant.findFirst({ where: { id: item.variantId, siteId } });
  if (!variant) return notFound();
  const body = await req.json().catch(() => ({}));
  const qty = clampQuantity(
    Number(body?.quantity ?? 1),
    variant.inventory,
    variant.inventoryPolicy,
  );
  await prisma.cartItem.update({ where: { id }, data: { quantity: qty } });
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  const item = cart?.items.find((i) => i.id === id);
  if (!cart || !item) return notFound();
  await prisma.cartItem.delete({ where: { id } });
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}
