# 8. Cookie sessions with an optimistic proxy gate

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The app has three audiences on the same domain: anonymous visitors of published
pages (`/p`, `/c`), unauthenticated users on auth screens (`/login`, `/signup`,
…), and authenticated builders (everything else). We needed authentication that
is simple, self-contained (no external IdP required), and fast on every
navigation — without trusting an easily-spoofed edge check for real security.
Next 16 also renamed `middleware` to `proxy`.

## Decision

Use **server-side sessions** stored in the database (`Session` with a unique
token), referenced by an HTTP cookie (`pc_session`). Passwords are hashed with
**scrypt** (`lib/auth/`). Enforce auth in **two layers**:

1. **Optimistic gate** in `proxy.ts` (the Next 16 replacement for middleware):
   a fast, cookie-*presence* check that redirects unauthenticated users away
   from builder routes and signed-in users away from auth pages. It deliberately
   does **not** validate the session.
2. **Authoritative checks** in server pages (`requireUser`, `requireWorkspace`)
   and API handlers (`requireApiUser`, see ADR 0010), which validate the session
   against the database.

Public routes (`/api`, `/p/`, `/c/`, `/internal/`) are never gated by the proxy;
API and the token-gated internal screenshot route enforce their own rules.

## Consequences

- **Positive:** The proxy is cheap (no DB call) and runs on every navigation for
  snappy redirects; real security never depends on it.
- **Positive:** DB-backed sessions can be revoked and carry expiry; scrypt
  hashing avoids external auth dependencies.
- **Positive:** Clear separation: routing convenience vs. authorization truth.
- **Negative:** Two-layer auth means the same intent is expressed in two places;
  the public-route allowlist in `proxy.ts` must be kept in sync as routes are
  added (e.g. the explicit note not to gate `/onboarding`).
- **Negative:** Server-side sessions require a DB lookup on protected requests
  (vs. stateless JWT), and cookie management must get `Secure`/`HttpOnly`/
  `SameSite` right.

## Alternatives considered

- **Stateless JWT sessions.** Rejected: harder to revoke and rotate; the app
  already has a database, so server sessions are simpler to reason about.
- **A third-party auth provider (NextAuth/Clerk/Auth0).** A redesign toward
  OAuth is documented as a future direction
  (`docs/superpowers/specs/2026-06-16-auth-redesign-oauth-design.md`); the
  current self-contained approach keeps the dev setup dependency-free.
- **Validating the session inside the proxy.** Rejected: would add a DB call to
  every navigation and couple edge routing to the data layer for no security gain
  over authoritative server-side checks.
