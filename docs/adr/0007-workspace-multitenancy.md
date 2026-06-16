# 7. Workspace-scoped multi-tenancy

- **Status:** Accepted
- **Date:** 2026-06-14

## Context

The product evolved from a single-user page builder into a collaborative studio.
Multiple users need to share pages, components, collections, assets, and a site
header/footer, with different permission levels, while keeping each
organization's data isolated. See `docs/superpowers/specs/2026-06-14-app-shell-workspaces-design.md`.

## Decision

Introduce a **`Workspace`** as the tenant boundary, with users joined via
**`Membership`** rows carrying a **`Role`** (`OWNER`, `ADMIN`, `EDITOR`,
`VIEWER`). Tenant-owned models carry a `workspaceId`.

- `workspaceId` is indexed on `Page`, `Component`, `Asset`, `Collection`,
  `Site` (unique — one site per workspace), and others.
- The **active workspace** is resolved per request from the session/cookie
  (`lib/auth/workspace.ts`), exposed to server pages via `requireWorkspace()`.
- Invites (`Invite`) grant membership by email + token with a role and expiry.
- Activity is tracked per workspace (`ActivityEvent`).
- `workspaceId` is nullable on some models to accommodate legacy/unscoped rows
  created before tenancy existed.

## Consequences

- **Positive:** Clean isolation boundary; collaboration, roles, and invites have
  a natural home. Most queries simply filter by the active `workspaceId`.
- **Positive:** One `Site` per workspace gives each tenant its own header/footer
  and design tokens.
- **Negative:** **Every** data access must be scoped by `workspaceId` — a missed
  filter is a cross-tenant data leak. This relies on discipline plus the guarded
  API layer (ADR 0010).
- **Negative:** Nullable `workspaceId` for legacy rows is a sharp edge: SQLite
  treats NULLs as distinct for uniqueness (noted explicitly for `Site`), and
  unscoped rows need careful handling or backfilling.
- **Negative:** Role checks are spread across handlers; correctness depends on
  consistently using the role-gating helpers.

## Alternatives considered

- **Database-per-tenant.** Rejected: heavy operationally for SQLite and overkill
  at this scale; shared schema with a tenant column is simpler.
- **User-owned resources (no workspace).** Rejected: cannot express shared
  ownership, roles, or invites — the core collaboration requirement.
- **Row-level security in the DB.** Not available in SQLite; tenancy is enforced
  in application code instead.
