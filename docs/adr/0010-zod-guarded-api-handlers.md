# 10. Zod-validated, role-guarded API handlers

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

There are ~30 API route handlers under `app/api/`. Every one of them needs the
same cross-cutting concerns done correctly and consistently: authenticate the
user, resolve the active workspace, enforce a minimum role (ADR 0007), validate
the request body, and return uniform error responses. Repeating this in each
handler invites omissions — and a missed workspace scope or role check is a
security bug. See `docs/superpowers/plans/2026-06-16-api-data-layer.md`.

## Decision

Centralize the cross-cutting concerns in **higher-order handler wrappers**
(`lib/api/api-handler.ts`) and validate all input with **Zod** schemas
(`lib/api/schemas.ts`).

- `withWorkspace(fn)` — requires an authenticated user and resolves the active
  workspace before calling `fn`.
- `withRole(minRole, fn)` — additionally enforces a minimum `Role`
  (`OWNER > ADMIN > EDITOR > VIEWER`).
- Handlers parse request bodies through Zod schemas; invalid input yields a
  consistent error shape rather than ad-hoc checks.

## Consequences

- **Positive:** Auth, tenancy, and role checks are applied uniformly and are hard
  to forget — a handler opts in by choosing the right wrapper.
- **Positive:** Zod gives runtime validation *and* inferred TypeScript types for
  request payloads, complementing the loosely-typed block JSON (ADR 0002).
- **Positive:** Uniform error responses simplify the client.
- **Negative:** A handler that bypasses the wrappers (or picks the wrong one)
  silently loses protection; the safety depends on convention, not the compiler.
- **Negative:** Schemas must be kept in sync with block/collection shapes that
  are otherwise free-form JSON, creating a second place to update.

## Alternatives considered

- **Per-handler inline auth/validation.** Rejected: duplicative and the most
  likely source of a missed check.
- **A tRPC layer.** Would give end-to-end types but is a larger architectural
  commitment; plain route handlers + Zod keep the surface minimal and match the
  App Router model (ADR 0001).
- **Class/decorator-based controllers.** Rejected: heavier abstraction than
  needed; function wrappers compose cleanly with Next route handlers.
