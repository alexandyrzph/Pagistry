import { requireApiRole, requireApiWorkspace, type Role, type WorkspaceCtx } from "@/lib/auth/workspace";
import { authzTotal } from "@/lib/observability";

type Guarded = WorkspaceCtx | { response: Response };

/**
 * Pure core: if the guard short-circuited, return its Response untouched;
 * otherwise invoke `fn` with the resolved workspace context.
 *
 * Records the authorization decision as a metric so denied/allowed rates are
 * visible for every guarded route without per-handler wiring.
 */
export async function runGuarded(
  guard: Guarded,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  if ("response" in guard) {
    authzTotal.inc({ result: "denied", status: guard.response.status });
    return guard.response;
  }
  authzTotal.inc({ result: "allowed", role: guard.role });
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
