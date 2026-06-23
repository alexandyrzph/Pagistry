import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth/auth";
import { getActiveWorkspace, hasRole, type Role, type WorkspaceCtx } from "@/lib/auth/workspace";

const SITE_COOKIE = "pc_site";
const jsonHeaders = { "content-type": "application/json" } as const;

export type ActiveSite = { id: string; name: string; handle: string; homePageId: string | null };
export type SiteCtx = WorkspaceCtx & { site: ActiveSite };

export function resolveActiveSite<T extends { id: string }>(
  sites: T[],
  wantedId: string | undefined,
): T | null {
  if (sites.length === 0) return null;
  return sites.find((s) => s.id === wantedId) ?? sites[0];
}

function res(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}

export const getActiveSite = cache(async (): Promise<SiteCtx | null> => {
  const ctx = await getActiveWorkspace();
  if (!ctx) return null;
  const sites = await prisma.site.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "asc" },
  });
  const jar = await cookies();
  const site = resolveActiveSite(sites, jar.get(SITE_COOKIE)?.value);
  if (!site) return null;
  return {
    ...ctx,
    site: { id: site.id, name: site.name, handle: site.handle, homePageId: site.homePageId },
  };
});

/** Server pages: resolve the active site (membership + cookie validated). Mirrors
 *  requireWorkspace — requireUser() runs first so signed-out users go to /login,
 *  and a signed-in user with no resolvable site falls back to /onboarding. */
export async function requireSite(): Promise<SiteCtx> {
  await requireUser();
  const ctx = await getActiveSite();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export async function requireApiSite(): Promise<SiteCtx | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: res(401, "Unauthorized") };
  const ctx = await getActiveSite();
  if (!ctx) return { response: res(403, "No site") };
  return ctx;
}

export async function requireApiSiteRole(min: Role): Promise<SiteCtx | { response: Response }> {
  const ctx = await requireApiSite();
  if ("response" in ctx) return ctx;
  if (!hasRole(ctx.role, min)) return { response: res(403, "Forbidden") };
  return ctx;
}

export async function setActiveSite(id: string): Promise<boolean> {
  const ctx = await getActiveWorkspace();
  if (!ctx) return false;
  const site = await prisma.site.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!site) return false;
  const jar = await cookies();
  jar.set(SITE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
