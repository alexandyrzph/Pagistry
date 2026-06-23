# Design: Multi-Site Model (Workspace → Sites)

**Status:** Draft for review · **Date:** 2026-06-21

**Foundation spec.** The custom-domains, e-commerce, and localization specs all build on
this model. It promotes `Site` from a per-workspace singleton into a first-class entity, so a
workspace (a team/tenant) can own many sites — each with its own domains, pages, collections,
assets, components, design system, and home page.

```
Workspace "Acme"          (team/tenant: members, roles, invites, billing)
├─ Site "Marketing"   →   acme.com, www.acme.com
├─ Site "Blog"        →   blog.acme.com
└─ Site "Store"       →   shop.acme.com   (commerce enabled)
```

---

## 1. Goal & scope

**Goal:** A workspace owns N sites. Each `Site` is a self-contained website: its own
domain(s), pages, collections, assets, reusable components, design tokens, header/footer, home
page, and (later) locales and a store.

**In scope:** the `Site` entity, rescoping content from `workspaceId` → `siteId`, per-site
home page, the data migration, access control, and the builder's site switcher.

**Out of scope (owned by sibling specs):** custom domains (`Domain` model + routing),
commerce fields, locale config — each sibling spec adds its own columns to `Site`/new tables and
references this one. Per-site member permissions are a noted future enhancement.

---

## 2. What scopes to Workspace vs. Site

| Concern                                                | Scope         | Notes                                                                                                                  |
| ------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Members, `Membership` (Role), `Invite`                 | **Workspace** | A workspace member can access **all** of its sites at their workspace role. Per-site roles are future.                 |
| Billing / plan                                         | **Workspace** | Future.                                                                                                                |
| `ActivityEvent` (audit)                                | **Workspace** | Gains an optional `siteId` for context.                                                                                |
| `Site` (name, home page, header/footer, design tokens) | itself        | Many per workspace.                                                                                                    |
| `Page`, `Collection` (+ `CollectionItem`)              | **Site**      | `siteId`.                                                                                                              |
| `Asset` (media library), `Component` (reusable)        | **Site**      | Per the product decision — each site has its own isolated assets + components.                                         |
| Design tokens (`colors`, `textStyles`)                 | **Site**      | Stay on `Site` (zero-move). Each site has its own branding. Workspace-level shared libraries are a future enhancement. |
| `Domain`                                               | **Site**      | Added by the custom-domains spec; FK is `siteId`.                                                                      |
| Products / orders                                      | **Site**      | Added by the e-commerce spec; a site is a "store" when commerce is enabled.                                            |
| Locale config                                          | **Site**      | Added by the localization spec (`defaultLocale`, `locales`).                                                           |

**Rule of thumb:** the workspace is the _team & billing boundary_; the site is the _website &
content boundary_.

---

## 3. Data model

### 3.1 `Site` (promoted to first-class)

Current `Site` is a per-workspace singleton (`workspaceId @unique`, holding
`header/footer/colors/textStyles`). Changes:

```prisma
model Site {
  id          String   @id @default(cuid())
  workspaceId String   // no longer @unique — a workspace has many sites
  name        String   @default("Untitled site")
  handle      String   // url-safe id for builder URLs, unique within the workspace
  homePageId  String?  // the page served at "/" — explicit, set at site creation; see §3.3
  header      String   @default("[]") // JSON Block[] — per site
  footer      String   @default("[]") // JSON Block[]
  colors      String   @default("[]") // JSON ColorToken[] — per-site design tokens
  textStyles  String   @default("[]") // JSON TextStyle[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([workspaceId, handle])
  @@index([workspaceId])
  // domains[], pages[], collections[], assets[], components[] relate back via siteId
  // locale + commerce columns are added by their respective specs.
}
```

`handle` drives the builder URL (e.g. `/sites/<handle>/...`) and is unique per workspace;
`name` is the human label. `homePageId` is what `/` resolves to under a custom domain.

### 3.2 Content rescoped to `siteId`

`Page`, `Collection`, `Asset`, `Component` lose `workspaceId` and gain `siteId` (the site's
`workspaceId` is reachable via the `Site` row, so access control resolves through it).

```prisma
model Page {
  // ...
  siteId String
  slug   String
  @@unique([siteId, slug]) // replaces the current GLOBAL `slug @unique`
  @@index([siteId])
}
```

The same `workspaceId → siteId` swap applies to `Collection`, `Asset`, `Component`.
Transitively scoped (unchanged, reached via their parent): `CollectionItem` (→ Collection),
`PageVersion` / `PageThumbnail` / `Submission` (→ Page).

**Key fix this unlocks:** `Page.slug` is currently **globally** `@unique`, which makes
`acme.com/about` and `globex.com/about` impossible — and even two sites in the _same_ workspace
couldn't both have `/about`, `/contact`, `/privacy`. Scoping to `@@unique([siteId, slug])` (not
`[workspaceId, slug]`) is what makes true multi-tenant paths work — a prerequisite the
custom-domains spec depended on.

### 3.3 Home page is explicit (no slug magic)

The page served at `/` is defined by `Site.homePageId` — never inferred from a magic slug
(`home` / `index`) and never a fragile try-home → try-index → 404 fallback chain. Creating a site
always creates a blank home page and sets `homePageId`, so a site effectively always has one; the
editor lets you reassign it ("Home = Page X"). `homePageId` is nullable in the schema **only** to
bootstrap a site before its first page exists; the app treats it as required and we intend to make
it `NOT NULL` once the create-flow guarantees it.

---

## 4. Migration (one-time)

SQLite + Prisma; the dev DB is `prisma/dev.db`. Run as a `prisma migrate` + a `tsx` data
backfill (mirrors the existing `scripts/migrate-workspaces.ts` pattern).

1. **Additive:** add `Site.name/handle/homePageId`; add nullable `siteId` to
   `Page/Collection/Asset/Component`; keep old `workspaceId` columns for now.
2. **Backfill:** for each workspace, take its existing single `Site` (or create one) → set
   `name = "Main site"`, `handle = "main"`. Point every `Page/Collection/Asset/Component` in that
   workspace at that site's `id`. Set `Site.homePageId` to the workspace's current home page if one
   exists, else the most-recently-updated page, else `null`. Existing globally-unique slugs are
   automatically unique within the single backfilled site, so `@@unique([siteId, slug])` is safe.
3. **Tighten:** make `siteId` non-null; drop the old `workspaceId` columns on
   `Page/Collection/Asset/Component`; drop `Site.workspaceId`'s `@unique`; add the new indexes/uniques.

Rollback = restore from a DB copy taken before step 1 (and the page-version history is unaffected).

---

## 5. Access control

- `lib/auth/workspace.ts` keeps `requireApiWorkspace` / `requireApiRole` for **workspace-level**
  ops (list sites, members, invites).
- Add `requireApiSite(siteId, minRole?)`: load the `Site`, resolve `Site.workspaceId`, then reuse
  the existing membership/role check. All content routes (`/api/pages`, `/api/collections`,
  `/api/assets`, `/api/components`, and the new `/api/sites/*`) move to site-scoped guards.
- A workspace member accesses every site in the workspace at their workspace role. (Per-site roles
  = future: add a `SiteMembership` table later without breaking this model.)

---

## 6. Builder UX

- **Workspace dashboard** lists **sites** (cards: name, primary domain, page count, last edited) +
  "New site".
- **Active-site context:** mirror the existing `pc_ws` workspace cookie with a `pc_site` cookie (or
  carry the site `handle` in the builder URL, e.g. `/sites/<handle>/pages`). The editor, CMS,
  design panel, and assets all read the active site.
- **Create site:** name → creates `Site` + a blank home `Page` + sets `homePageId` + an empty
  default header/footer. Optionally clone an existing site as a template (future).
- **Delete site:** cascades pages/collections/assets/components/domains (guarded, ADMIN+).

---

## 7. Public routing (summary; details in the custom-domains spec)

- A request's **host** → `Domain.hostname` → `siteId` (custom-domains spec).
- `/` → `Site.homePageId` (explicit — no `home`/`index` slug convention); `/<slug>` → the `Page` with
  that slug **in that site**; `/c/<col>/<item>` → CMS detail **in that site**. The render layer (Node
  runtime) does the host→site lookup; the proxy stays Prisma-free. An unknown host — or the transient
  case of a site with no `homePageId` — → 404.

---

## 8. Phasing / milestones

- **P1 — model + migration:** schema change, backfill, site-scoped guards, `/api/sites` CRUD,
  `homePageId`, `@@unique([siteId, slug])`.
- **P2 — builder:** site switcher, dashboard-of-sites, create/delete site, active-site context
  across editor/CMS/design/assets.
- **P3 — enablement for siblings:** confirms the `Site` row is the anchor the custom-domains,
  localization, and e-commerce specs attach to.

---

## 9. Testing strategy

Gate stays `tsc --noEmit` + `vitest` + `eslint` (flat strict) + `prettier` (not `next build`).
Unit-test (node env): the backfill mapping (workspace→default-site, content→siteId, homePage
selection), `requireApiSite` resolution, and per-site slug uniqueness. The migration script gets a
dry-run mode + a fixture DB test.

---

## 10. Risks & open questions

- **Migration on a live dev DB** — must snapshot `prisma/dev.db` first; the column drops are
  destructive. Provide the backfill as an idempotent, resumable script.
- **`pc_site` vs URL-carried site** — cookie is simplest but ambiguous across tabs; URL-carried
  `handle` is more explicit. Recommend URL-carried in the builder, with the last-used site as the
  default redirect target.
- **Per-site assets/components** mean no cross-site reuse — if "share a logo/component across sites"
  becomes a need, add a workspace-level shared library later (additive).
- **Existing hardcoded `pagistry.com` canonical URL** in `app/p/[slug]` must become host-aware
  (also flagged by the custom-domains spec).

---

### Related specs

- **Custom domains** — `Domain` FKs to `siteId`; host → site resolution; `Site.homePageId` serves `/`.
- **Localization** — locale config (`defaultLocale`, `locales`) lives on `Site`; content overrides are per `Page`/`CollectionItem` within a site.
- **E-commerce** — a `Site` becomes a store when commerce is enabled; products/orders are `siteId`-scoped; the Stripe Connect account attaches to the store `Site`.
