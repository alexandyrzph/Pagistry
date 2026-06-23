# Custom Domains — Design Spec

- **Date:** 2026-06-21
- **Status:** Draft (design) — ready for implementation plan
- **Owner:** Alexander
- **Product:** Pagistry (Next.js 16 · React 19 · Prisma 6 + SQLite · multi-workspace page builder)

---

## 1. Goal & scope

Let a site attach its own domain (e.g. `acme.com`, `www.acme.com`) so that its **published**
content serves there. A visitor hitting `acme.com/` sees that site's home page; `acme.com/about`
serves its `about` page; `acme.com/c/blog/<item>` serves a CMS detail page — all without the
`pagistry.com/p/<slug>` URL ever appearing.

**Depends on the multi-site-model foundation spec** (`2026-06-21-multi-site-model-design.md`),
which promotes `Site` to a first-class entity: a workspace owns many sites, content
(`Page`/`Collection`/`Asset`/`Component`) is `siteId`-scoped with per-site unique slugs
(`@@unique([siteId, slug])`), and each site has an explicit `Site.homePageId` served at `/`. This
spec attaches `Domain` to that `Site` and resolves a host to a site; it does **not** define `Site`,
slug uniqueness, or the home-page pointer — those are owned by the foundation.

**In scope**

- A `Domain` model attached to `Site`, with a lifecycle (`pending → verifying → active → error`).
- DNS-based **domain-ownership verification** using Node's `dns` module.
- **Host → site** request routing so the public render path is driven by the incoming `Host`
  header, not by the builder's `pc_ws` / `pc_site` context.
- TLS + HTTP routing via a **self-hosted reverse proxy (Caddy) with on-demand TLS**, gated by a new
  `GET /api/domains/check` ask-endpoint.
- A per-site **Domains settings page** (add / verify / remove / set-primary), gated to ADMIN+.

**Out of scope / non-goals**

- Managed platform SSL-for-SaaS (Vercel Domains, Cloudflare for SaaS) — see §2.
- Wildcard / subdomain-per-record domains (needs DNS-01 challenge) — §9, future phase.
- Per-domain email, DMARC, or vanity sending domains.
- Billing/limits on number of domains (hook left for the billing workstream).
- Changing how the **builder** chooses its active workspace/site (`pc_ws` / `pc_site` stay
  builder-only).

---

## 2. Decisions & rationale

**Decision (set by product owner): self-hosted Caddy with on-demand TLS.** Caddy fronts the
Next.js server. On the first TLS handshake for an unknown SNI, Caddy asks our app whether that host
is allowed (the **ask endpoint**, §6); if yes, it obtains a per-domain Let's Encrypt certificate
on demand and caches/renews it automatically. The app owns the source of truth (the `Domain` table);
Caddy owns certificates and the renewal cron.

| Option                                             | Why / why not                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caddy on-demand TLS (chosen)**                   | No third-party dependency or per-domain SaaS fee; certs issue automatically the first time a verified domain is hit; renewal is Caddy's problem. Fits a self-hosted Next 16 + SQLite deployment. Cost is operational (we run/monitor Caddy + cert storage).                |
| Traefik on-demand                                  | Equivalent capability; Caddy's `on_demand_tls { ask … }` is the simplest concrete contract for our app to implement, so we standardize on Caddy. Traefik remains a drop-in alternative — the app side (ask endpoint, routing) is proxy-agnostic.                           |
| Platform SSL-for-SaaS (Vercel/Cloudflare for SaaS) | Lowest ops burden, but introduces a vendor + API + cost, and couples routing to that platform. Explicitly **not chosen now** per the product decision. The app-side contract (one hostname ↔ one site, verified ownership) is portable, so a future migration stays cheap. |

**Corollary decision — keep Prisma out of `proxy.ts`.** Even though Next 16's proxy runs on the
Node runtime by default, the proxy docs warn it "is meant to be invoked separately of your render
code … you should not attempt relying on shared modules or globals." Importing the Prisma client and
hitting SQLite on every navigation (and risking it on asset paths if the matcher ever slips) is both a
best-practice violation and a latency tax. The routing design (§5) therefore does **zero** DB work in
the proxy: the host → site lookup happens in the Node-runtime **render layer** via `headers()`.

---

## 3. Data model

New enum + model (Prisma already proves SQLite enums work here — see `enum Role`).

```prisma
enum DomainStatus {
  PENDING    // created, awaiting DNS + verification
  VERIFYING  // a verification check is in flight
  ACTIVE     // ownership proven + DNS points at us; serves traffic, eligible for a cert
  ERROR      // last check failed (DNS missing/mismatch); lastError holds the reason
}

model Domain {
  id                String       @id @default(cuid())
  siteId            String
  site              Site         @relation(fields: [siteId], references: [id], onDelete: Cascade)
  hostname          String       @unique // normalized: lowercase, no scheme/port, no trailing dot
  status            DomainStatus @default(PENDING)
  verificationToken String       @default(cuid()) // value placed in the _pagistry-verify TXT record
  verifiedAt        DateTime?
  isPrimary         Boolean      @default(false)   // canonical host for this site (app-enforced: ≤1 true)
  redirectToPrimary Boolean      @default(true)    // non-primary hosts 308 → the primary (apex/www, §9)
  lastCheckedAt     DateTime?
  lastError         String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([siteId])
}
```

Add the back-relation to the foundation's `Site` model:

```prisma
model Site {
  // …existing fields (from the multi-site-model foundation spec)…
  domains Domain[]
}
```

**Apex vs www.** Each hostname is its **own** `Domain` row (`acme.com` and `www.acme.com` are two
rows). They are related only by sharing a `siteId` — a single `Site` can carry several domains; one of
the pair carries `isPrimary = true` and the other redirects to it (§9). This keeps the unique
constraint and the cert/ask contract a flat per-hostname affair.

**Depends on the multi-site-model foundation spec.** Serving `acme.com/` needs a "home page" notion,
per-site slugs so two sites can both own `/about`, and a stable `siteId` to attach domains to. The
foundation spec provides all three: it introduces the first-class `Site`, scopes content to `siteId`,
makes slugs unique per site (`@@unique([siteId, slug])` — replacing the legacy global `slug @unique`),
and adds the explicit `Site.homePageId` that `/` resolves to. This spec consumes those primitives; it
does **not** add `homePageId`, change slug uniqueness, or define a home-page fallback chain — there is
no slug magic, `/` is exactly `Site.homePageId`.

**Migration mechanics.** New `Domain` table only (the `Site`, `siteId` scoping, and `homePageId`
columns are landed by the foundation migration, which this spec sequences after); no data backfill for
`Domain`. Apply with `prisma db push` (project convention), then **restart `next dev`** — the cached
Prisma client will not see the new `domain` delegate otherwise (known gotcha in this repo). Local
`prisma/dev.db`.

---

## 4. Domain-verification flow

Goal: prove the site's owners control the DNS for the hostname **before** it can serve there or get a
cert. All DNS work runs in a **Node-runtime route handler** (`dns/promises`); never in the proxy.

**Add a domain** (`POST /api/domains`, ADMIN+):

1. Normalize input → lowercase, strip scheme/port/trailing dot; reject IPs, the app's own host, bare
   public suffixes, and malformed hostnames.
2. Enforce global uniqueness (`hostname @unique`) → `409` if already claimed (by any site).
3. Create `Domain { status: PENDING, verificationToken }` and return DNS instructions.

**DNS instructions shown to the user**

| Record    | Purpose              | Apex (`acme.com`)                                                          | Subdomain (`www.acme.com`)                         |
| --------- | -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Ownership | proves control       | `TXT _pagistry-verify.acme.com = "pagistry-domain-verification=<token>"` | `TXT _pagistry-verify.www.acme.com = "…=<token>"` |
| Routing   | points traffic at us | `A acme.com → <server IP>` (or `ALIAS/ANAME` if the provider supports it)  | `CNAME www.acme.com → cname.pagistry.com`         |

(Apex cannot use a CNAME per DNS rules; we instruct an `A`/`ALIAS`. `cname.pagistry.com` is a stable
DNS name that resolves to the Caddy front-door, so the server IP can change without customer action.)

**Verify** (`POST /api/domains/:id/verify`, ADMIN+ — also runnable by a background re-check):

1. `status → VERIFYING`, `lastCheckedAt = now()`.
2. `dns.promises.resolveTxt("_pagistry-verify.<host>")` → must contain `…=<token>` (ownership).
3. `dns.promises.resolveCname`/`resolve4` on the host → must point at our CNAME target / server IP
   (routing). A mismatch here is a soft warning, not a hard fail, because some providers flatten/proxy
   records; ownership is the authoritative gate.
4. Success → `status: ACTIVE`, `verifiedAt = now()`, `lastError = null`. Failure → `status: ERROR`,
   `lastError = <reason>`. Verification is **idempotent** and safe to re-run.

**Re-verification / renewal.** TLS issuance + renewal is entirely Caddy's job (on-demand, auto-renew);
the app never touches certificates. A periodic re-check (cron job or P2 status-poll) can flip an
`ACTIVE` domain back to `ERROR` if its DNS later breaks; the ask endpoint (§6) keeps gating cert
handshakes to `ACTIVE` rows, so a broken domain stops getting fresh certs.

---

## 5. Request routing (the edge-vs-Prisma problem, solved)

The crux: map the incoming `Host` header to a `Site` and render the right page — without running
Prisma in the proxy. The lookup chain is **Host → `Domain.hostname` → `siteId` → `Site`**.

### Resolution strategy — render-layer lookup (chosen)

**`proxy.ts` does no DB work.** Its only new job is a pure string test: _is this request's host the
app's own host, or a custom domain?_ It compares `Host` against `APP_PRIMARY_HOST`
(e.g. `pagistry.com`, plus `localhost`/preview hosts). It does **not** need a host → site map at
all, because Caddy has already refused the TLS handshake for any host that isn't an `ACTIVE` domain
(§6) — so by the time a custom-domain request reaches Next, the host is known-good. (Defense in depth:
the render layer re-validates against the DB and 404s an unknown host.)

For a **custom-domain** request, the proxy rewrites the _path shape_ so existing render routes handle
it, then lets the page resolve the site from the host:

| Incoming (on `acme.com`)     | Proxy action                       | Renders                                                   |
| ---------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `/`                          | rewrite → `/p/__home__` (sentinel) | home route resolves `Site.homePageId` for the host's site |
| `/about`                     | rewrite → `/p/about`               | `app/p/[slug]` (host-scoped, see below)                   |
| `/c/blog/<item>`             | pass through                       | `app/c/[slug]/[item]` (host-scoped)                       |
| `/api/*`, `/_next/*`, assets | pass through                       | unchanged                                                 |

The proxy passes the host forward (it is already on the request; optionally also set an explicit
`x-pc-host` request header via `NextResponse.rewrite({ request: { headers } })` for clarity). All
**site resolution happens in the Node-runtime render layer**:

```ts
// lib/domains/resolve.ts  (Node runtime; React-cache'd per request)
export const resolveHostSite = cache(async (host: string) => {
  const hostname = normalizeHost(host);
  const domain = await prisma.domain.findUnique({
    where: { hostname },
    include: { site: true },
  });
  if (!domain || domain.status !== "ACTIVE") return null;
  return { siteId: domain.siteId, site: domain.site, domain };
});
```

- `app/p/[slug]/page.tsx` gains: read `headers().get("host")` → `resolveHostSite` → look up the
  page by **`{ siteId, slug }`** (per-site unique, from the foundation) and assert
  `page.siteId === siteId`. 404 if the slug isn't in the host's site. This is the line that makes a
  custom domain serve **only** its own site's pages.
- A new home route handles the `__home__` sentinel: resolve host → site → `Site.homePageId` →
  render that `Page` via the existing `PageDocument`.
- `app/c/[slug]/[item]/page.tsx` scopes header/footer/components/collections by `siteId`; it gains the
  same host → site assertion so a CMS item only serves under its owning site's domain.

**Why this over the alternatives**

- _In-proxy in-memory cache of host → siteId._ Rejected: the proxy docs explicitly say not to rely
  on shared modules/globals; a per-instance Map is unreliable across the "separately invoked" proxy and
  needs invalidation plumbing for slow value (cache only saves the lookup the render layer already does
  cheaply and cache-able).
- _Internal resolve API (`fetch` from proxy on every request)._ Rejected: adds a network round-trip to
  every navigation for no benefit over resolving once in the render layer.
- _Prisma directly in proxy._ Technically possible on Next 16's Node runtime, but violates the
  separation guidance and risks DB hits on asset/prefetch paths.

### Dropping the `pc_ws` / `pc_site` dependency on the public path

The public render path **must derive the site from the host**, never from `pc_ws` / `pc_site`.
`pc_ws` (set by `setActiveWorkspace`, read by `getActiveWorkspace` in `lib/auth/workspace.ts`) and the
foundation's active-site context are builder/session concepts and are simply absent for anonymous
visitors. Two consequences:

1. `app/p/[slug]` and `app/c/...` call `resolveHostSite(host)` — they never read the active
   workspace/site context.
2. An owner browsing their own live site **while logged in** still gets the host's site, not their
   currently-active builder site — because the resolver ignores cookies entirely.

`proxy.ts`'s existing optimistic auth gate is unaffected for builder routes; custom-domain hosts only
ever hit `/p`, `/c`, and the home route, which the gate already treats as public.

---

## 6. Caddy on-demand TLS

Caddy fronts Next.js and only issues certs for hostnames our app approves. The **ask endpoint** is the
gatekeeper: Caddy calls it with the requested SNI; a `2xx` means "issue/serve a cert", anything else
denies the handshake.

```caddyfile
{
  # Global on-demand TLS: ask the app before issuing a cert for any unknown SNI.
  on_demand_tls {
    ask http://127.0.0.1:3000/api/domains/check
  }
}

# Customer custom domains: on-demand cert per verified hostname.
https:// {
  tls {
    on_demand
  }
  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-Host {host}
    header_up X-Forwarded-Proto {scheme}
  }
}

# The app's own host keeps a normal managed cert (not on-demand).
pagistry.com, www.pagistry.com {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy appends `?domain=<sni>` to the ask URL. The new route:

```
GET /api/domains/check?domain=<host>   → 200 (empty body) if an ACTIVE Domain with that hostname
                                          exists, else 403.
```

Implementation: normalize `domain`, `prisma.domain.findUnique({ where: { hostname } })`, return `200`
iff `status === "ACTIVE"`, else `403`. No auth (Caddy calls it server-to-server over loopback), no
body, fast. **Register it in `endpoints.ts`** for completeness/tests even though Caddy — not the axios
client — is the caller.

**Rate-limiting / abuse.** Because the ask endpoint only approves `ACTIVE` (DNS-verified) hostnames,
the cert-issuance surface is bounded by _verified_ domains, which defuses cert-flooding by design.
Additional hardening: bind the ask endpoint to loopback/the Caddy network only; add a lightweight
IP/host rate limit so a flood of bogus SNIs (which all get `403`) can't hammer the DB; optionally enable
Caddy's rate-limit module in front of on-demand issuance.

---

## 7. Builder UI

New per-site **Domains** settings page (under a site's settings), for managing that one site's
domains. It is gated **ADMIN+** via the workspace membership of the site's workspace: the foundation's
`requireApiSite(siteId, "ADMIN")` resolves `Site → workspaceId` and reuses the existing
membership/role check on every mutating route, plus a server-side role check on the page. All calls go
through the axios `api` client using paths from `endpoints.ts` (no hardcoded URLs).

- **List** current domains with a status pill (`pending` / `verifying` / `active` / `error`) and the
  primary badge.
- **Add domain** → input → shows the copy-pasteable DNS instructions table (§4) and a "Verify" button.
- **Verify** → calls `…/verify`, refreshes status; on `error`, surfaces `lastError`.
- **Set primary** → `…/primary`; flips `isPrimary` (app guarantees ≤1 per site) and configures the
  apex↔www redirect direction.
- **Remove** → deletes the row (frees the hostname globally) with a confirm dialog warning that the
  live site stops serving there.

Endpoints to add to `lib/api/endpoints.ts`:

```ts
domains: {
  list: "/api/domains",
  byId: (id: string) => `/api/domains/${id}`,
  verify: (id: string) => `/api/domains/${id}/verify`,
  primary: (id: string) => `/api/domains/${id}/primary`,
  // called by Caddy, registered for completeness/tests:
  check: (host: string) => `/api/domains/check?domain=${encodeURIComponent(host)}`,
},
```

---

## 8. Security & abuse

- **Ownership proof.** A domain cannot reach `ACTIVE` without the `_pagistry-verify` TXT token (§4).
  Only `ACTIVE` domains route traffic or get certs.
- **One hostname ↔ one site.** `hostname @unique` makes claims globally exclusive; a second site (in
  any workspace) adding the same host gets `409`. No cross-site/cross-workspace takeover.
- **Host-scoped rendering.** The render layer asserts the resolved page/CMS item belongs to the host's
  site (§5), so a custom domain can never be coaxed into serving another site's content.
- **Reserved/forbidden hosts.** Reject the app's own apex/subdomains, IP literals, `localhost`, and
  bare public suffixes (e.g. `co.uk`) at add-time.
- **Cert-flooding.** The ask endpoint approves only verified `ACTIVE` hosts; unknown SNIs get `403` and
  never trigger issuance. Rate-limit the ask endpoint and (optionally) Caddy's on-demand issuance.
- **Ask-endpoint exposure.** Loopback/internal-only; returns no site/workspace identifiers — just `200/403`.
- **Trust the forwarded host carefully.** Next must read the host from Caddy's `X-Forwarded-Host` only
  when behind the trusted proxy; do not honor client-supplied `X-Forwarded-Host` from arbitrary
  origins.

---

## 9. Edge cases

| Case                                 | Handling                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **apex + www**                       | Two `Domain` rows; one `isPrimary`. The non-primary (with `redirectToPrimary`) issues a `308` to the primary host, preserving path + query. Redirect applied in the home/`[slug]` render layer (host-aware) or by a Caddy redirect block.                          |
| **Domain already taken**             | `hostname @unique` → `409` at add-time (against any site); no silent reassignment.                                                                                                                                                                                 |
| **Local dev / preview**              | `APP_PRIMARY_HOST` includes `localhost:3000` and preview hosts; the proxy's custom-domain branch is skipped for them, so dev keeps using `pagistry.com/p/<slug>`. Testing a real custom domain locally needs a hosts-file entry + the ask endpoint returning 200. |
| **Removing an ACTIVE domain**        | Row deleted → ask endpoint now `403`s that host → new handshakes fail and the render layer 404s it. Optionally purge the cached cert via Caddy's admin API; otherwise it simply expires.                                                                           |
| **DNS points at us but unverified**  | Caddy refuses the cert (ask `403`) until `ACTIVE`; user sees a TLS error until verification completes — surfaced as a clear "verify your domain" state in the UI.                                                                                                  |
| **Wildcard / `*.acme.com`**          | Out of scope: on-demand HTTP issuance can't do wildcards (needs DNS-01). Deferred (§12).                                                                                                                                                                           |
| **Page slug collision across sites** | Already handled by the foundation's `@@unique([siteId, slug])`; the render layer additionally asserts the resolved page belongs to the host's site (§5).                                                                                                           |

---

## 10. Phasing / milestones

**P0 — foundation (prerequisite, separate spec).** The multi-site-model migration must land first: it
provides `Site`, `siteId`-scoped content, per-site unique slugs (`@@unique([siteId, slug])`), and
`Site.homePageId`. This spec builds on that and adds nothing to it.

**P1 — serve a verified domain.**
`Domain` model + migration (FK `siteId`) · `POST/GET/DELETE /api/domains` (ADMIN+) ·
`POST /api/domains/:id/verify` (Node `dns`) · `GET /api/domains/check` ask endpoint · Caddyfile with
on-demand TLS · proxy host-detection + path rewrite · host-scoped `app/p/[slug]` + home route +
`app/c/...` (host → site) · minimal per-site Domains settings page (add/verify/remove). One domain per
site works end-to-end.

**P2 — polish & canonicalization.**
`isPrimary` + apex↔www `308` redirects · multiple domains per site · status-polling UI +
`lastError` surfacing · periodic re-verification (cron) · canonical-URL/OG/JSON-LD generation switched
from the hardcoded `https://pagistry.com` (in `app/p/[slug]`) to the host's primary domain.

**P3 — future.** Wildcard/DNS-01 domains · per-domain analytics · billing limits on domain count.

---

## 11. Testing strategy

Gate: `tsc --noEmit` + `vitest` + `eslint` (flat, strict) + `prettier`. (Do **not** run `next build`
alongside a live `next dev` — shared `.next/` causes render loops; tsc + vitest is the gate.)

**Unit (vitest, node env)**

- **Hostname normalization** — case/port/scheme/trailing-dot stripping; rejection of IPs, app host,
  bare public suffixes, malformed input.
- **Verification logic** — mock `dns/promises` (`resolveTxt`/`resolveCname`) for success, token
  mismatch, `ENOTFOUND`, and routing-mismatch-but-ownership-ok; assert status transitions
  (`PENDING/VERIFYING → ACTIVE | ERROR`) and `lastError`.
- **`resolveHostSite`** — mock Prisma: returns the site only for `ACTIVE` rows; `null` for
  `pending/error/unknown`.
- **Ask endpoint** — `200` for active host, `403` otherwise; ignores query casing/whitespace.
- **Proxy routing decision** — app host vs custom host classification and path-rewrite targets, using
  `unstable_doesProxyMatch` / proxy test utilities from `next/experimental/testing/server`.
- **Host-scoping guard** — `app/p/[slug]` 404s when a slug resolves to a page outside the host's
  site.

**Manual / runtime** — hosts-file a fake domain → Caddy on-demand issues a cert (or local self-signed)
→ `/`, `/<slug>`, `/c/...` render the right site; removing the domain 404s it.

---

## 12. Risks & open questions

- **Foundation must land first.** Per-site slugs (`@@unique([siteId, slug])`), `siteId`-scoped content,
  and `Site.homePageId` are all owned by the multi-site-model spec; this spec assumes they exist and
  does not re-derive them. If the foundation slips, this work blocks.
- **Caddy cert storage** must be persistent across deploys (a volume), or every redeploy re-issues
  certs and risks Let's Encrypt rate limits.
- **On-demand cold start** — the first request per domain pays a cert-issuance latency; acceptable, but
  worth a "warming"/pre-issue step for primary domains in P2.
- **Forwarded-host trust** — must read `X-Forwarded-Host` only from the trusted Caddy hop.
- **Proxy "no globals" caveat** — reaffirms the no-cache-in-proxy choice; if profiling later shows the
  per-request DB resolve is hot, add caching in the Node render layer (React `cache` + a short TTL),
  never in the proxy.

### Related specs

- **Multi-site model** (`2026-06-21-multi-site-model-design.md`) — **dependency / foundation.** Promotes
  `Site` to a first-class entity, scopes content to `siteId`, makes slugs unique per site
  (`@@unique([siteId, slug])`), and adds `Site.homePageId`. This spec attaches `Domain` to `Site` and
  resolves Host → Domain → Site → Page on top of it; it must land **after** the foundation migration.
- **Localization** — locale subpaths (`acme.com/es/about`) must resolve under custom domains. The host
  resolver runs **before** locale parsing: strip/identify the locale prefix, then look up
  `{ siteId, slug }`. A future per-domain default locale would live on `Domain`.
- **E-commerce** — storefront routes (`/products`, `/cart`, checkout) serve under custom domains via the
  same host → site resolution. Checkout/session cookies must be issued on the **primary** host
  (use the apex↔www redirect so sessions aren't split across hostnames).
