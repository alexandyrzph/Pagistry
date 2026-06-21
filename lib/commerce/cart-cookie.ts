import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/request-host";
import { getActiveSite } from "@/lib/auth/site";

const CART_COOKIE = "pc_cart";

export async function storeSiteIdFromHost(): Promise<string | null> {
  const resolved = await resolveHostSite(await requestHost());
  if (resolved) return resolved.siteId;
  const ctx = await getActiveSite();
  return ctx?.site.id ?? null;
}

export async function getCart(siteId: string) {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return null;
  return prisma.cart.findFirst({
    where: { token, siteId, status: "open" },
    include: { items: true },
  });
}

export async function getOrCreateCart(siteId: string) {
  const existing = await getCart(siteId);
  if (existing) return existing;
  const jar = await cookies();
  const cart = await prisma.cart.create({ data: { siteId } });
  jar.set(CART_COOKIE, cart.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return prisma.cart.findUnique({ where: { id: cart.id }, include: { items: true } });
}
