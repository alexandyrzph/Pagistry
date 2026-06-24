import { slugify } from "@/lib/utils";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "./auth";
import type { Prisma } from "@prisma/client";
type Db = Prisma.TransactionClient | typeof prisma;

// ---------------------------------------------------------------------------
// Pure role helpers
// ---------------------------------------------------------------------------

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

/** True when `role` is at least as privileged as `min`. */
export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Pure slug candidate: n=1 → base, n>1 → base-n. Empty/whitespace → "workspace".
 *  Note: slugify() has a built-in "page" fallback so we check name.trim() first. */
export function slugCandidate(name: string, n: number): string {
  const root = name.trim() ? slugify(name) : "workspace";
  return n <= 1 ? root : `${root}-${n}`;
}

// ---------------------------------------------------------------------------
// Server tenancy guards
// ---------------------------------------------------------------------------

const WS_COOKIE = "pc_ws";
const jsonHeaders = { "content-type": "application/json" } as const;

export type ActiveWorkspace = { id: string; name: string; slug: string };
export type WorkspaceCtx = { user: SessionUser; workspace: ActiveWorkspace; role: Role };

function res(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}

/** Resolve the active workspace from the pc_ws cookie (membership-validated),
 *  falling back to the user's oldest membership. Read-only (never writes cookies). */
export const getActiveWorkspace = cache(async (): Promise<WorkspaceCtx | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const jar = await cookies();
  const wanted = jar.get(WS_COOKIE)?.value;
  const m = memberships.find((x) => x.workspaceId === wanted) ?? memberships[0];
  return {
    user,
    workspace: { id: m.workspace.id, name: m.workspace.name, slug: m.workspace.slug },
    role: m.role as Role,
  };
});

/** Server pages: resolve the active workspace. Callers run requireUser() first, so
 *  this only fires for an authenticated user with no membership — a state the
 *  delete-workspace guard prevents (users always keep ≥1 workspace). /onboarding is
 *  the safe fallback that re-drives setup. */
export async function requireWorkspace(): Promise<WorkspaceCtx> {
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** Route handlers: any member (VIEWER+). Returns ctx or a Response. */
export async function requireApiWorkspace(): Promise<WorkspaceCtx | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: res(401, "Unauthorized") };
  const ctx = await getActiveWorkspace();
  if (!ctx) return { response: res(403, "No workspace") };
  return ctx;
}

/** Route handlers: require at least `min` role. Returns ctx or a Response. */
export async function requireApiRole(min: Role): Promise<WorkspaceCtx | { response: Response }> {
  const ctx = await requireApiWorkspace();
  if ("response" in ctx) return ctx;
  if (!hasRole(ctx.role, min)) return { response: res(403, "Forbidden") };
  return ctx;
}

/** Validate membership, then persist the active workspace in pc_ws. */
export async function setActiveWorkspace(id: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const m = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: id } },
  });
  if (!m) return false;
  const jar = await cookies();
  jar.set(WS_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

async function uniqueWorkspaceSlug(name: string, db: Db = prisma): Promise<string> {
  let n = 1;
  while (n < 1000) {
    const slug = slugCandidate(name, n);
    const existing = await db.workspace.findUnique({ where: { slug } });
    if (!existing) return slug;
    n++;
  }
  return `${slugCandidate(name, 1)}-${Date.now()}`;
}

export async function createWorkspace(
  { userId, name, logoUrl }: { userId: string; name: string; logoUrl?: string | null },
  db: Db = prisma,
): Promise<ActiveWorkspace> {
  const run = async (tx: Db): Promise<ActiveWorkspace> => {
    const cleanName = (name || "Workspace").trim().slice(0, 80) || "Workspace";
    const slug = await uniqueWorkspaceSlug(cleanName, tx);
    const created = await tx.workspace.create({
      data: { name: cleanName, slug, logoUrl: logoUrl ?? null },
    });
    await tx.membership.create({ data: { userId, workspaceId: created.id, role: "OWNER" } });
    return { id: created.id, name: created.name, slug: created.slug };
  };
  return "$transaction" in db ? db.$transaction(run) : run(db);
}
