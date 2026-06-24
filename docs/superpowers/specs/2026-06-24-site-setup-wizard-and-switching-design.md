# Site setup wizard, switching & editor page settings — design

**Date:** 2026-06-24
**Status:** Approved design, pending spec review

## Problem

Today a workspace, a "Main site", and a "Home" page are all **auto-created** at signup (`app/api/auth/signup/route.ts:34-40` → `createWorkspace` → `createSite`). The onboarding carousel is purely cosmetic — it sets `User.onboardedAt` and drops the user on the dashboard. The user is never asked to name or brand anything, there is no site switcher in the sidebar, and a page's slug and web settings can't be edited from the editor.

We want the user, **after** finishing onboarding, to be explicitly prompted to create a workspace and a site (with names, images, favicon, and an optional custom domain), to switch sites easily from the sidebar, and to edit page slugs and related web settings from inside the editor.

## Goals

1. Stop auto-creating a workspace/site at signup; prompt the user to create them after onboarding.
2. Capture workspace name + image, site name + image + favicon, and an optional custom domain (settable later).
3. Scope pages by site (already true) and let the user switch the active site from the sidebar.
4. Let the user edit a page's slug and other web settings from the editor.

## Non-goals / scope calls

- **No "hide from nav" toggle.** Nav links are added manually (no auto-page-list nav exists to hide from).
- **No site-wide `noindex`.** Per-page `Page.noindex` only; a whole-site noindex toggle is out of scope.
- "Set as homepage" reuses the existing `Site.homePageId` — no new schema.
- Domain capture in the wizard reuses the **existing** custom-domains P1 system (`/api/domains`, `DomainsManager`, DNS TXT verify). No new domain logic.

## Approach (chosen: "separate gated setup route")

Keep the onboarding carousel as-is. After `onboardedAt` is set, the `(app)` layout checks whether the user has an active workspace **with ≥1 site**; if not, it redirects to a new full-screen `/setup` route hosting the create wizard. The wizard's step forms are extracted as **reusable components** that are also mounted as modals behind the sidebar's "New workspace…" / "New site…" actions — one set of forms, two contexts.

Rejected alternatives: extending the onboarding carousel (couples cosmetic onboarding to real data creation; "new site later" becomes a separate codepath) and a no-gate dashboard empty state (doesn't satisfy "must be _prompted_ to create").

## Design

### 1. Data model (`prisma/schema.prisma`)

```prisma
model Site {
  // …existing (id, workspaceId, name, handle, homePageId, header, footer, …)…
  logoUrl     String?   // site image/logo
  faviconUrl  String?   // favicon (separate field, per requirement)
}

model Page {
  // …existing (id, title, slug, content, siteId, published, metaTitle, …)…
  noindex     Boolean   @default(false)  // per-page "hide from search"
}
```

- `Workspace.logoUrl` already exists (`schema.prisma:224-234`) — reused for the workspace image.
- Images/favicons reuse the existing Asset upload system (`/api/upload` + `AssetPicker`); we store only the URL.

### 2. Decouple creation helpers, switch to payload objects

`createWorkspace` currently auto-creates a site (`lib/auth/workspace.ts:128-138`); `createSite` is positional (`lib/sites/create.ts:17-26`). Both become single-payload functions, and `createWorkspace` no longer creates a site:

```ts
createWorkspace({ userId, name, logoUrl }, db?)   // workspace + OWNER membership ONLY
createSite({ workspaceId, name, logoUrl, faviconUrl }, db?)  // site + home page
```

Each takes an options object plus an optional `db` arg for the transaction handle. The wizard's finish step composes them in one transaction:

```ts
await prisma.$transaction(async (tx) => {
  const wsId = workspaceId ?? (await createWorkspace({ userId, name, logoUrl }, tx)).id;
  await createSite({ workspaceId: wsId, name, logoUrl, faviconUrl }, tx);
});
```

Update all existing callers of both functions to the new signatures.

### 3. Signup change (`app/api/auth/signup/route.ts`)

Remove the `createWorkspace(...)` call. New users have no workspace until they finish the wizard. Existing users are unaffected (they already have one).

Relax the "can't delete your last workspace/site" guards to allow a zero-state — the gate routes those users back to the wizard.

### 4. The gate + `/setup` wizard

- **Gate** in `app/(app)/layout.tsx`, immediately after the existing `if (!user.onboarded) redirect("/onboarding")` (line 13): resolve the active workspace; if there is none, or it has **zero sites**, `redirect("/setup")`.
- **`/setup`** — a new full-screen route with its own layout (no app shell). Server-side, it redirects to `/` if the user already has a workspace + site (so it isn't reachable once setup is complete).
- **Wizard steps** (stepper built from `components/ui` primitives):
  1. **Workspace** — `name` (required) + logo (optional). Auto-skipped if the user already has a workspace but no sites.
  2. **Site** — `name` (required) + site image (optional) + favicon (optional). Handle/slug auto-derived from the name.
  3. **Domain (optional)** — "Connect a custom domain" (hostname + DNS instructions via existing `/api/domains`) **or** "Skip — set this up later."
  4. **Finish** — runs the transaction above, sets `pc_ws` + `pc_site` cookies, redirects to the dashboard (`/`) scoped to the new site.

**Required vs. optional:** only the two names are required; everything else is skippable and editable later from settings.

**Reusable forms:** `WorkspaceForm`, `SiteForm`, `DomainStep` are standalone components composed by both the full-screen wizard and the sidebar modals (section 5).

### 5. Sidebar switchers (`components/app-shell/Sidebar.tsx`)

Layout: workspace switcher on top, **site switcher stacked directly below it** (scoped to the active workspace), active site always visible, one click to switch.

- New **`SiteSwitcher`** — lists the active workspace's sites (`GET /api/sites`); selecting one → `POST /api/sites/switch` → reload.
- "**New site…**" → opens `SiteForm` in a modal → `POST /api/sites` → switch to it.
- "**New workspace…**" (existing button in `WorkspaceSwitcher`) → now opens the **full wizard** (workspace + first site) as a modal, instead of silently creating an empty workspace.

All built from `components/ui` primitives + `dialog-provider` (`useConfirm`/`useAlert`), mirroring `CollectionManager`, including delete actions (admin-UI standard).

### 6. Editor page-settings surface (`components/editor/LeftPanel.tsx`)

Rework the narrow "seo" tab into a consolidated **"Page" panel** with four groups:

- **Slug** — editable, validated unique within the site (`@@unique([siteId, slug])`). New `setSlug` action in `store/editor-store.ts` + `PATCH /api/pages/[id]`. Warn that changing a published page's slug changes its public URL.
- **SEO + social** — folds in the existing `SeoPanel` (metaTitle, metaDescription, ogImage) + the new `Page.noindex` toggle.
- **Status & homepage** — published/draft toggle (reuses existing TopBar logic) + "Set as site homepage" (`Site.homePageId`).
- **Site shortcuts** — inline site name, favicon, and domain status, editable without leaving the editor (writes through the same site PATCH used by `/site-settings`).

### 7. API surface

All HTTP via axios (`lib/api/client.ts` `api`) + the endpoint registry (`lib/api/endpoints.ts`) — no hardcoded URLs.

- `POST /api/workspaces` → accepts `{ name, logoUrl? }`; no longer auto-creates a site.
- `POST /api/sites` → accepts `{ name, logoUrl?, faviconUrl? }`.
- `PATCH /api/sites/[id]` → name / logo / favicon (reuse/extend the site-settings update path).
- `PATCH /api/pages/[id]` → slug (validated) / metaTitle / metaDescription / ogImage / noindex / set-as-homepage.

### 8. Favicon wiring

Render `<link rel="icon" href={site.faviconUrl}>` into the published site `<head>` (host-scoped render path / `resolveHostSite`) and the editor preview, so an uploaded favicon actually appears.

## Testing

Gate: `tsc` + `vitest` + `lint` + `format:check`. Do **not** run `next build` while `next dev` is live.

- Gate logic: no workspace → `/setup`; workspace with zero sites → `/setup`; complete → dashboard.
- `createWorkspace` creates a workspace **without** a site; `createSite` creates site + home page.
- Wizard finish creates workspace + site in one transaction and sets both `pc_ws` and `pc_site` cookies.
- Slug `PATCH` rejects duplicate slugs within a site; allows the same slug across different sites.
- `SiteSwitcher` flips the active site (cookie + dashboard list).
- Favicon `<link>` renders in the published head when `Site.faviconUrl` is set.

## Affected files (reference)

- Onboarding/gate: `app/(auth)/onboarding/page.tsx`, `app/(app)/layout.tsx`, `app/api/auth/onboard/route.ts`
- Signup: `app/api/auth/signup/route.ts`
- Creation helpers: `lib/auth/workspace.ts`, `lib/sites/create.ts`
- New setup route + wizard: `app/setup/…`, `components/setup/{WorkspaceForm,SiteForm,DomainStep}.tsx`
- Sidebar: `components/app-shell/Sidebar.tsx`, `components/app-shell/WorkspaceSwitcher.tsx`, new `SiteSwitcher`
- APIs: `app/api/workspaces/route.ts`, `app/api/sites/route.ts`, `app/api/sites/[id]/route.ts`, `app/api/sites/switch/route.ts`, `app/api/pages/[id]/route.ts`, `lib/api/endpoints.ts`
- Editor: `components/editor/LeftPanel.tsx`, `components/editor/SeoPanel.tsx`, `store/editor-store.ts`
- Render: host-scoped render / `resolveHostSite` head
- Schema: `prisma/schema.prisma` (`Site`, `Page`)
