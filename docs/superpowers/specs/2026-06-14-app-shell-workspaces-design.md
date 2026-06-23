# Spec 1 — App Shell + Workspaces

- **Date:** 2026-06-14
- **Status:** Approved (design) — ready for implementation plan
- **Owner:** Alexander
- **Product:** Pagistry Studio (working name — rename pending; see Branding workstream)

---

## 1. Context

Pagistry is a polished full-stack drag-and-drop visual page builder (Next.js 16, React 19,
Tailwind v4, Prisma + SQLite, framer-motion, zustand, dnd-kit, tiptap). It already has: a
drag-and-drop block editor on an iframe canvas, AI section/page generation, a CMS
(collections + bindings), global header/footer, version history, a shared design system
(color + text tokens), responsive breakpoints, rich text, uploads, forms + a submissions
inbox, and auth + onboarding.

Two limitations break the "real product" feel:

1. **Navigation** is a top navbar with a hardcoded "Acme Inc · Workspace" chip. The product
   already has more primary destinations than a navbar comfortably holds, and more are coming.
2. **Tenancy** is a single _shared_ workspace — every signed-in user sees the same pages.
   This is the one thing that quietly breaks the SaaS illusion and blocks collaboration,
   profiles, and team monetization.

This spec is the **first of five workstreams** (see §12). It replaces the navbar with a
left-sidebar app shell and introduces real per-team tenancy.

### North star

Decided in brainstorming: optimize for a **production-credible SaaS** — a stranger should
believe this is a fundable product. That single bar makes it an outstanding portfolio piece,
a launchable product, and a tool worth using.

### Research that shaped this spec

- **Positioning:** the open white space is _"AI builds it, you own it"_ (AI-first generation +
  clean, exportable, version-controlled code). Realtime collaboration is the other uncontested
  angle — no AI-first builder has Figma-grade multiplayer. Both are deferred workstreams; this
  spec lays their foundation.
- **Tenancy:** research independently identifies "org/roles + sidebar shell + workspace-scoped
  billing/AI credits" as a single highest-leverage foundational move — validating the decision
  to pull full tenancy into this spec. Billing is excluded here (its own workstream); a stub
  card marks its place.
- **Sidebar:** for 5–10+ destinations and a growing hierarchy a left sidebar beats a navbar.
  Reference IA: Linear (calm density, keyboard-first), Notion (workspace switcher +
  sectioning), Vercel (team/project switcher).
- **Account vs workspace split:** account settings = the person (spans workspaces); workspace
  settings = the team/billing unit. Roles Owner/Admin/Editor/Viewer.

---

## 2. Goals

- Replace the navbar with a collapsible **left-sidebar app shell** wrapping all management
  surfaces, leaving the editor's full-screen chrome untouched.
- Promote **Design**, **Site**, and **Components** from editor-only panels to first-class
  destinations; add **Activity** and a **⌘K command palette**.
- Introduce **real per-team tenancy**: `Workspace`, `Membership` (roles), `Invite`, with all
  content scoped to a workspace and a functional **workspace switcher**.
- Add **member management, role enforcement, and invites**.
- Relocate the profile into the sidebar and add **account** + **workspace settings** pages.
- Keep styling **themeable** so the branding workstream can lock the palette later.

## 3. Non-goals (explicitly deferred)

- **Billing / Stripe** — stub "coming soon" card in workspace settings only.
- **Realtime collaboration** — separate workstream; this spec only makes its preconditions true.
- **Rename + final palette** — branding workstream.
- **Deep anti-empty work** (seeded demo content, template gallery) — branding/UX workstream.
  This spec ships _contextual empty states_ on every new surface, not seeding.
- **SMTP email** — invites and resets surface an on-screen link (existing pattern).

---

## 4. Data model (Prisma)

New models:

- `Workspace { id, name, slug @unique, logoAssetId?, createdAt, updatedAt }`
- `Membership { id, userId, workspaceId, role: Role, createdAt, @@unique([userId, workspaceId]) }`
- `Invite { id, workspaceId, email, role: Role, token @unique, invitedById, expiresAt, acceptedAt?, createdAt }`
- `ActivityEvent { id, workspaceId, actorId, type: String, targetId?, meta: String /*json*/, createdAt }`
- `enum Role { OWNER ADMIN EDITOR VIEWER }`

Changes to existing models:

- Add `workspaceId` (FK → `Workspace`) to: `Page`, the CMS collection model(s), `Asset`,
  `Site`, and the component model. Index `workspaceId` on each.
- Design-system tokens currently live on `Site`; they ride along via `Site.workspaceId`.
- Submissions and version history inherit scope through their parent `Page`.
- `User` is unchanged structurally; active workspace is **not** stored on the user (see §5).

## 5. Tenancy plumbing

- **Active workspace** is held in an httpOnly `pc_ws` cookie. It is always membership-validated
  on read; on a miss it falls back to the user's first membership and rewrites the cookie.
- `lib/workspace.ts`:
  - `getActiveWorkspace()` → `{ workspace, role }` for the current user (React `cache`d).
  - `requireWorkspace()` → server-page variant (redirect if none).
  - `requireApiWorkspace()` → route-handler variant (returns `{ workspace, role }` or a 403/401 `Response`), composing with the existing `requireApiUser()`.
  - `requireWorkspaceRole(min: Role)` → throws/returns 403 when the member's role is below `min`.
  - `setActiveWorkspace(id)` → validates membership, writes `pc_ws`.
- **Query scoping:** every existing builder query gains a `where: { workspaceId }` filter.
  Every mutating route additionally calls `requireWorkspaceRole(...)` (see role matrix §9).
- `proxy.ts` is unchanged — it stays an optimistic auth-cookie gate; workspace checks live at
  the data layer.

## 6. Migration

One-time, idempotent script run after `prisma db push`:

1. Create a default `Workspace` (name seeded from today's "Acme Inc", slug `acme` or generated).
2. Create an `OWNER` `Membership` for each existing `User`.
3. Set `workspaceId` on every existing `Page`, collection, `Asset`, `Site`, and component to
   the default workspace.
4. Backfill nothing for `ActivityEvent` (starts empty).

Constraints: touches **only this app's** database. Restart `next dev` after
the schema change (cached-client gotcha).

---

## 7. App shell architecture

- **Route group `app/(app)/`** with one shared `layout.tsx` (server component): loads user +
  memberships + active workspace, reads the collapse-state cookie (SSR width matches), and
  renders `<Sidebar … />` + `<main>{children}</main>`.
- **Inside the group:** `/` (Pages), `/components`, `/cms`, `/assets`, `/design`, `/site`,
  `/forms`, `/activity`, `/settings/*`, `/account/*`, `/invite/[token]`.
- **Outside the group (full-screen, untouched):** `/editor/[id]`, `/component/[id]`,
  `/collection/[id]/template`, `/site/[region]`, and public `/p/[slug]`, `/c/[slug]/[item]`.
- The existing dashboard moves to `app/(app)/page.tsx` and is refactored to **drop its own
  `<header>`** — the sidebar is now the chrome. Its New / Generate-with-AI / Search actions
  move into an in-content page header.

### Sidebar component (`components/app-shell/`)

Server shell with client interactivity islands. Top → bottom:

1. **WorkspaceSwitcher** — current workspace (logo/avatar + name); dropdown lists the user's
   workspaces with their role, plus "Create workspace" and "Account settings". Switching calls
   `setActiveWorkspace` and refreshes.
2. **Actions** — "New" (page / component / collection menu) and "Search ⌘K".
3. **Grouped nav** — **BUILD**: Pages · Components · CMS · Assets · **BRAND**: Design · Site ·
   **GROW**: Forms · Activity. Active-route highlight.
4. **Footer** — Settings, then the profile menu (avatar + name → Account, theme toggle, Sign out).

Behavior: collapsible to an **icon rail** (tooltips when collapsed); state persisted to a
cookie. Mobile (`< ~768px`): off-canvas **drawer** triggered from a slim top bar.

Theming: all sidebar colors are CSS tokens. Default is a **dark rail / light content**
("pro tool") look, swappable in one place; the branding workstream locks the final palette.

### Command palette (`components/app-shell/CommandPalette.tsx`)

Dependency-free (consistent with the project's no-extra-deps ethos). Global ⌘K (and `/` focus).
Sources: nav destinations, the workspace's pages (fetched), and quick actions (New page,
Generate with AI, Invite member, Open Settings, Toggle theme). Fuzzy filter + full keyboard
navigation.

---

## 8. Manager pages

| Route         | Purpose                          | Notes                                                                  |
| ------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `/`           | **Pages**                        | Existing dashboard grid, header removed, workspace-scoped.             |
| `/components` | **Components** list              | Links into existing `/component/[id]` editor.                          |
| `/cms`        | **CMS / Collections** list       | Links into existing `/collection/[id]`.                                |
| `/assets`     | **Assets** browser               | Reuses the AssetPicker grid as a full page.                            |
| `/design`     | **Design system** manager        | Promotes the editor's design panel to a page; writes workspace tokens. |
| `/site`       | **Site** (header/footer) landing | Links to the `/site/[region]` editors.                                 |
| `/forms`      | **Forms / submissions**          | Today's modal generalized to a page, across all pages.                 |
| `/activity`   | **Activity** feed                | Reverse-chron `ActivityEvent` timeline with actor avatars.             |

Every page renders a **contextual empty state** (what appears here, why it matters, one CTA) —
never "No data yet."

`ActivityEvent`s are written on key mutations: page created/updated/published, collection
created, member joined, invite sent. Logging is best-effort and never blocks the mutation.

---

## 9. Members, roles, invites & settings

### Role matrix

| Capability                           | Viewer | Editor | Admin | Owner |
| ------------------------------------ | :----: | :----: | :---: | :---: |
| View pages / CMS / assets            |   ✅   |   ✅   |  ✅   |  ✅   |
| Create / edit / publish content      |   —    |   ✅   |  ✅   |  ✅   |
| Manage design system & site          |   —    |   ✅   |  ✅   |  ✅   |
| Manage members & invites             |   —    |   —    |  ✅   |  ✅   |
| Workspace settings (name/slug/logo)  |   —    |   —    |  ✅   |  ✅   |
| Delete / transfer workspace, billing |   —    |   —    |   —   |  ✅   |

Enforced server-side in every mutating route via `requireWorkspaceRole(...)`. The UI also hides
or disables controls a role can't use (defense in depth, but the server is the gate).

### Workspace settings — `/settings` (Admin+)

- **General** — name, slug, logo.
- **Members & Invites** — list members + roles (change role, remove), pending invites,
  "Invite by email" → creates an `Invite` and shows the **invite link on-screen** (no SMTP;
  matches the forgot-password pattern). Accept flow at `/invite/[token]` → join + redirect.
- **Billing** — stub "coming soon" card.
- **Danger zone** — transfer ownership, delete workspace (Owner only).

### Account settings — `/account`

- **Profile** — name, avatar (via existing upload/Asset system).
- **Security** — change password.
- **Preferences** — theme.
- **Danger zone** — delete account.

---

## 10. Theming

Sidebar and shell chrome are driven by CSS custom properties (a small token set:
rail bg, rail fg, rail muted, accent, active bg). Default values give the dark-rail look; the
branding workstream changes them in one place. No light/dark _toggle_ obligation in this spec
beyond the profile-menu theme switch wiring (can be a no-op placeholder if the token system
isn't dual-mode yet — to be confirmed during planning).

---

## 11. Verification

- **Unit tests:** `lib/workspace.ts` — active-workspace resolution/fallback, scoping filters,
  and `requireWorkspaceRole` gate for each role.
- **Runtime (the real bar):** drive the running app —
  1. Sidebar renders; nav between all sections works; collapse persists across reloads.
  2. ⌘K opens, filters, and navigates.
  3. Workspace switch changes which pages/CMS/assets are visible (scoping proven).
  4. Create a second workspace; it starts empty with proper empty states.
  5. Invite by email → open invite link in a second account → joins with the chosen role.
  6. Role enforcement: a Viewer cannot edit/publish (control disabled **and** API returns 403).
  7. `/account` and `/settings` render and save.
- Screenshots of the shell, switcher, members page, and command palette.

---

## 12. Roadmap context (the five workstreams)

1. **App Shell + Workspaces** — _this spec._
2. **Workspace depth** — billing/AI credits, deeper member management (covered partly here).
3. **Branding + "don't feel empty"** — rename, palette lock, seeded demo workspace, template
   gallery, richer dashboard, marketing landing page.
4. **Realtime collaboration** — presence (avatars + live cursors) and multiplayer editing.
   Recommended stack: **Liveblocks** for a fast demo, **Yjs self-hosted** for production;
   iframe-cursor coordinate translation is a solved pattern.
5. **AI "you own it"** — clean code export paired with AI generation (the core positioning).

---

## 13. Open questions (resolve during planning)

- Slug generation/collision strategy for `Workspace.slug`.
- Whether `/collection/[id]` and `/component/[id]` detail editors move inside the shell now or
  stay full-screen (default: stay; only list pages are added this pass).
- Theme toggle: real dual-mode tokens now, or wire the control and defer dual-mode to branding.
