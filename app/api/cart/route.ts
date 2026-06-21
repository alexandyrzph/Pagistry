import { json, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  return json({ cart: cart ?? { items: [] } });
}
