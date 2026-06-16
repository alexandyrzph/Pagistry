import { requireApiRole, requireApiWorkspace, type Role, type WorkspaceCtx } from "@/lib/auth/workspace";

type Guarded = WorkspaceCtx | { response: Response };

/**
 * Pure core: if the guard short-circuited, return its Response untouched;
 * otherwise invoke `fn` with the resolved workspace context.
 */
export async function runGuarded(
  guard: Guarded,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  if ("response" in guard) return guard.response;
  return fn(guard);
}

/** Require any workspace membership (VIEWER+), then run `fn` with the workspace context. */
export async function withWorkspace(
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiWorkspace(), fn);
}

/** Require at least `min` role, then run `fn` with the workspace context. */
export async function withRole(
  min: Role,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiRole(min), fn);
}
