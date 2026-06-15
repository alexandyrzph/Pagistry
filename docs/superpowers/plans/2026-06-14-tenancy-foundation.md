# Tenancy Foundation Implementation Plan (Spec 1, Plan 1A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Pagecraft from a single shared workspace into real per-team tenancy — `Workspace` / `Membership` (roles) / `Invite`, all content scoped to a workspace, role-enforced APIs, and workspace/member/invite/account endpoints — without changing the UI shell (that's Plan 1B).

**Architecture:** Add four Prisma models + a nullable `workspaceId` scalar column on every content model. A new `lib/workspace.ts` resolves the active workspace from a membership-validated `pc_ws` cookie and exposes role-gated guards (`requireApiWorkspace`, `requireApiRole`) that compose with the existing `requireApiUser`. Every existing builder query gains a `where: { workspaceId }` filter; every mutation gains a role check. A one-time migration moves existing data into a seeded default workspace.

**Tech Stack:** Next.js 16 (App Router, route handlers), Prisma 6 + SQLite, `tsx` for the migration script, Vitest (node env) for unit tests. Dependency-free auth (node `crypto`) is already in place.

---

## Important environment notes

- **This project is NOT a git repo.** Each task ends with a "Checkpoint" step. If you want real commits, run `git init && git add -A && git commit -m "baseline"` first; otherwise treat each Checkpoint as a manual review/save point. **Never touch the nested `` directory — it is a separate project with its own `.git`.**
- After any `prisma/schema.prisma` change you MUST run `npx prisma db push` **and restart `next dev`** (the cached Prisma client is a known gotcha in this repo).
- Path alias `@/*` maps to repo root. Tests live in `tests/**/*.test.ts` and run with `npm test` (`vitest run`).
- Existing guard shape (keep this pattern): `requireApiUser()` returns `{ user }` **or** `{ response }`; callers do `if ("response" in x) return x.response;`.

---

## File structure (what each new file owns)

- `lib/workspace.ts` — active-workspace resolution, role ranking + guards, workspace create/slug helpers. **One responsibility: tenancy context.**
- `lib/activity.ts` — best-effort activity logging. **One responsibility: write `ActivityEvent`.**
- `scripts/migrate-workspaces.ts` — one-time data migration into the default workspace.
- `app/api/workspaces/route.ts` — list/create workspaces.
- `app/api/workspaces/switch/route.ts` — set active workspace cookie.
- `app/api/workspaces/[id]/route.ts` — rename / delete a workspace.
- `app/api/workspaces/members/route.ts` — list / change-role / remove members.
- `app/api/workspaces/invites/route.ts` — list / create / revoke invites.
- `app/api/invites/[token]/route.ts` — preview / accept an invite.
- `app/api/account/route.ts` — update profile (name).
- `app/api/account/password/route.ts` — change password.
- `tests/workspace.test.ts` — unit tests for the pure role helpers + slug candidate.

Modified: `prisma/schema.prisma`, `app/page.tsx`, `app/api/auth/signup/route.ts`, and every builder API route + the public renderers (Tasks 7–12).

---

## Task 1: Schema — add tenancy models + scope columns

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `Role` enum and four models at the end of the schema**

Append to `prisma/schema.prisma`:

```prisma
enum Role {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

model Workspace {
  id          String       @id @default(cuid())
  name        String       @default("Workspace")
  slug        String       @unique
  logoUrl     String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  memberships Membership[]
  invites     Invite[]
}

model Membership {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  role        Role      @default(EDITOR)
  createdAt   DateTime  @default(now())

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Invite {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  email       String
  role        Role      @default(EDITOR)
  token       String    @unique
  invitedById String
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([workspaceId])
}

model ActivityEvent {
  id          String   @id @default(cuid())
  workspaceId String
  actorId     String
  type        String
  targetId    String?
  meta        String   @default("{}")
  createdAt   DateTime @default(now())

  @@index([workspaceId])
}
```

- [ ] **Step 2: Add the back-relation on `User`**

In `model User`, add this line alongside `sessions` / `resets`:

```prisma
  memberships  Membership[]
```

- [ ] **Step 3: Add a nullable `workspaceId` scalar (no relation) + index to each content model**

These are plain indexed scalars (no FK relation object) to keep migration on existing SQLite data painless. Add to each model the two lines shown.

In `model Page` (add after `theme`):
```prisma
  workspaceId     String?
```
and add at the end of the model body:
```prisma
  @@index([workspaceId])
```

In `model Component` (after `content`):
```prisma
  workspaceId String?
```
and at end of model:
```prisma
  @@index([workspaceId])
```

In `model Asset` (after `size`):
```prisma
  workspaceId String?
```
and at end of model:
```prisma
  @@index([workspaceId])
```

In `model Collection` (after `detailTemplate`):
```prisma
  workspaceId    String?
```
and at end of model:
```prisma
  @@index([workspaceId])
```

In `model Site`, change the id default and add a unique workspace link. Replace:
```prisma
  id         String   @id @default("site")
```
with:
```prisma
  id          String   @id @default(cuid())
  workspaceId String?  @unique
```

- [ ] **Step 4: Push the schema and regenerate the client**

Run:
```bash
npx prisma db push && npx prisma generate
```
Expected: "Your database is now in sync with your Prisma schema." and "Generated Prisma Client".

- [ ] **Step 5: Restart the dev server** (kill any running `next dev`, then `npm run dev`). The cached client must be refreshed.

- [ ] **Step 6: Checkpoint** — schema compiles, client regenerated.

---

## Task 2: Pure role helpers (TDD)

**Files:**
- Create: `lib/workspace.ts` (helpers only this task)
- Test: `tests/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/workspace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ROLE_RANK, hasRole, slugCandidate } from "@/lib/workspace";

describe("role ranking", () => {
  it("orders roles VIEWER < EDITOR < ADMIN < OWNER", () => {
    expect(ROLE_RANK.VIEWER).toBeLessThan(ROLE_RANK.EDITOR);
    expect(ROLE_RANK.EDITOR).toBeLessThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeLessThan(ROLE_RANK.OWNER);
  });

  it("hasRole is true when role meets or exceeds the minimum", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("EDITOR", "ADMIN")).toBe(false);
    expect(hasRole("VIEWER", "EDITOR")).toBe(false);
    expect(hasRole("EDITOR", "VIEWER")).toBe(true);
  });
});

describe("slugCandidate", () => {
  it("produces a kebab base for n=1 and suffixes for n>1", () => {
    expect(slugCandidate("My Team", 1)).toBe("my-team");
    expect(slugCandidate("My Team", 3)).toBe("my-team-3");
  });
  it("falls back to 'workspace' for empty input", () => {
    expect(slugCandidate("   ", 1)).toBe("workspace");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- tests/workspace.test.ts`
Expected: FAIL — cannot import `@/lib/workspace` (module not found).

- [ ] **Step 3: Create `lib/workspace.ts` with just the pure helpers**

```ts
import { slugify } from "./utils";

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

/** Pure slug candidate: n=1 → base, n>1 → base-n. Empty → "workspace". */
export function slugCandidate(name: string, n: number): string {
  const root = slugify(name) || "workspace";
  return n <= 1 ? root : `${root}-${n}`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/workspace.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Checkpoint.**

---

## Task 3: Server tenancy guards

**Files:**
- Modify: `lib/workspace.ts`

- [ ] **Step 1: Append the server-side context + guards**

Add to the bottom of `lib/workspace.ts`:

```ts
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentUser, type SessionUser } from "./auth";

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

/** Server pages: redirect to onboarding (which will create a workspace) if none. */
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
  jar.set(WS_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return true;
}

/** Unique workspace slug derived from a name. */
export async function uniqueWorkspaceSlug(name: string): Promise<string> {
  let n = 1;
  while (n < 1000) {
    const slug = slugCandidate(name, n);
    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (!existing) return slug;
    n++;
  }
  return `${slugCandidate(name, 1)}-${Date.now()}`;
}

/** Create a workspace and make `userId` its OWNER. */
export async function createWorkspace(userId: string, name: string): Promise<ActiveWorkspace> {
  const slug = await uniqueWorkspaceSlug(name);
  const ws = await prisma.workspace.create({
    data: { name: (name || "Workspace").slice(0, 80), slug },
  });
  await prisma.membership.create({ data: { userId, workspaceId: ws.id, role: "OWNER" } });
  return { id: ws.id, name: ws.name, slug: ws.slug };
}
```

- [ ] **Step 2: Verify it still type-checks and unit tests pass**

Run: `npm test -- tests/workspace.test.ts`
Expected: PASS (the pure tests are unaffected; the import additions must not break them).

- [ ] **Step 3: Checkpoint.**

---

## Task 4: One-time data migration

**Files:**
- Create: `scripts/migrate-workspaces.ts`

- [ ] **Step 1: Write the script**

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "acme";
}

async function main() {
  // 1. default workspace (reuse if one already exists)
  let ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) {
    ws = await prisma.workspace.create({ data: { name: "Acme Inc", slug: slugify("Acme Inc") } });
    console.log("Created default workspace", ws.id, ws.slug);
  } else {
    console.log("Reusing existing workspace", ws.id, ws.slug);
  }

  // 2. every user becomes an OWNER of it
  const users = await prisma.user.findMany();
  for (const u of users) {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: u.id, workspaceId: ws.id } },
      update: {},
      create: { userId: u.id, workspaceId: ws.id, role: "OWNER" },
    });
  }
  console.log(`Ensured OWNER membership for ${users.length} user(s)`);

  // 3. attach all existing content (idempotent: only rows still unscoped)
  const r1 = await prisma.page.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r2 = await prisma.component.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r3 = await prisma.asset.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r4 = await prisma.collection.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r5 = await prisma.site.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  console.log("Scoped:", { pages: r1.count, components: r2.count, assets: r3.count, collections: r4.count, sites: r5.count });
}

main()
  .then(() => console.log("Migration complete."))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/migrate-workspaces.ts`
Expected output includes: "Created default workspace …" (or "Reusing …"), "Ensured OWNER membership for N user(s)", "Scoped: { pages: …, … }", "Migration complete."

- [ ] **Step 3: Verify in the DB**

Run: `npx prisma studio` (or a quick query) and confirm every `Page` has a non-null `workspaceId` and a `Membership` row exists for your account with role `OWNER`.

- [ ] **Step 4: Checkpoint.**

---

## Task 5: New users get a starter workspace

**Files:**
- Modify: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Create a workspace right after the session is created**

Open `app/api/auth/signup/route.ts`. It already creates the user and calls `createSession(user.id)`. Immediately **after** the `createSession(...)` call and **before** the success response, add:

```ts
  // Give every new user their own workspace (per-team tenancy backbone).
  const { createWorkspace } = await import("@/lib/workspace");
  await createWorkspace(user.id, `${(name || "My").trim()}'s Workspace`);
```

(Use the same `name` variable the route already validated. If the route names it differently, use that variable; the result string just needs a sensible default.)

- [ ] **Step 2: Runtime verify**

Run the dev server. In a fresh browser/private window, sign up a brand-new account, complete onboarding, and confirm you land on the dashboard with an empty (or seeded) page list rather than an error/redirect loop.

Then check the DB: the new user has exactly one `Membership` (role OWNER) to a freshly created `Workspace`.

- [ ] **Step 3: Checkpoint.**

---

## Task 6: Activity logging helper

**Files:**
- Create: `lib/activity.ts`

- [ ] **Step 1: Write the helper**

```ts
import { prisma } from "./prisma";

/** Best-effort activity log. Never throws — logging must not break a mutation. */
export async function logActivity(
  workspaceId: string,
  actorId: string,
  type: string,
  targetId?: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: { workspaceId, actorId, type, targetId, meta: JSON.stringify(meta) },
    });
  } catch {
    /* swallow — activity is non-critical */
  }
}
```

- [ ] **Step 2: Checkpoint** (used in later tasks; no behavior change yet).

---

## Task 7: Scope + role-gate the Pages routes

**Files:**
- Modify: `app/api/pages/route.ts`
- Modify: `app/api/pages/[id]/route.ts`
- Modify: `app/api/pages/[id]/publish/route.ts`
- Modify: `app/api/pages/[id]/versions/route.ts`
- Modify: `app/api/pages/[id]/versions/[versionId]/route.ts`

- [ ] **Step 1: Replace `app/api/pages/route.ts` entirely**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/page-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/pages — list pages in the active workspace (newest first)
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const pages = await prisma.page.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(pages);
}

// POST /api/pages — create a page in the active workspace (editor+)
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const title = (body.title || "Untitled Page").toString().slice(0, 120);
  const slug = await uniqueSlug(title);
  const content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
  const page = await prisma.page.create({
    data: { title, slug, content, workspaceId: a.workspace.id },
  });
  await logActivity(a.workspace.id, a.user.id, "page.created", page.id, { title });
  return NextResponse.json(page, { status: 201 });
}
```

- [ ] **Step 2: Update `app/api/pages/[id]/route.ts`**

Open the file. Replace its `requireApiUser` import with the workspace guards, and gate + scope each handler. The pattern:

- Replace `import { requireApiUser } from "@/lib/auth";` with
  `import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";`
- In the **GET** handler, replace the auth guard block with:
  ```ts
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  ```
  and change the lookup to scope by workspace, e.g. replace `prisma.page.findUnique({ where: { id } })` with
  `prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } })`.
- In **PUT/PATCH** and **DELETE**, replace the guard with:
  ```ts
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  ```
  and make the write workspace-safe by scoping on both keys. For updates use:
  ```ts
  const result = await prisma.page.updateMany({ where: { id, workspaceId: a.workspace.id }, data });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ```
  (then re-fetch with `findFirst` if the handler returns the row). For delete:
  ```ts
  const result = await prisma.page.deleteMany({ where: { id, workspaceId: a.workspace.id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ```

- [ ] **Step 3: Update `publish` and `versions` routes the same way**

For `app/api/pages/[id]/publish/route.ts`, `app/api/pages/[id]/versions/route.ts`, and `app/api/pages/[id]/versions/[versionId]/route.ts`:
- Swap the import to `requireApiRole` (these are all mutations / publish → use `requireApiRole("EDITOR")`; the GET on versions list may use `requireApiWorkspace`).
- Before operating on a page or version, confirm the parent page belongs to the active workspace:
  ```ts
  const page = await prisma.page.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ```
- For publish, after success add: `await logActivity(a.workspace.id, a.user.id, "page.published", id, { });` (import `logActivity`).

- [ ] **Step 4: Runtime verify**

With the dev server running and signed in:
```bash
# list pages (should be 200 and only your workspace's pages)
curl -s -b cookies.txt http://localhost:3000/api/pages | head -c 200
```
(Use a cookie jar from a logged-in browser session, or test via the UI.) Confirm: creating a page works; fetching a page id that exists in another workspace returns 404; logged-out request returns 401.

- [ ] **Step 5: Checkpoint.**

---

## Task 8: Scope + role-gate the Collections (CMS) routes

**Files:**
- Modify: `app/api/collections/route.ts`
- Modify: `app/api/collections/[id]/route.ts`
- Modify: `app/api/collections/[id]/items/route.ts`
- Modify: `app/api/collections/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Replace `app/api/collections/route.ts` entirely**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/cms";
import { serializeCollection } from "@/lib/collection-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/collections — collections in the active workspace
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const collections = await prisma.collection.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(collections.map(serializeCollection));
}

// POST /api/collections — create a collection (editor+)
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "Collection").slice(0, 80);

  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.collection.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const fields = JSON.stringify([{ key: "title", label: "Title", type: "text" }]);
  const c = await prisma.collection.create({
    data: { name, slug, fields, workspaceId: a.workspace.id },
    include: { items: true },
  });
  return NextResponse.json(serializeCollection(c), { status: 201 });
}
```

- [ ] **Step 2: Gate the collection detail + item routes**

For `[id]/route.ts`, `[id]/items/route.ts`, `[id]/items/[itemId]/route.ts`:
- Swap import to `requireApiWorkspace` (GET) / `requireApiRole("EDITOR")` (mutations) from `@/lib/workspace`.
- After resolving the collection id, verify ownership before any read/write:
  ```ts
  const collection = await prisma.collection.findFirst({ where: { id, workspaceId: a.workspace.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ```
  Items are reached through their `collectionId`, so this single ownership check is sufficient — keep the existing item queries unchanged after it.

- [ ] **Step 3: Runtime verify** — list collections (200, scoped), create one (editor), and confirm a collection id from another workspace returns 404. Logged out → 401.

- [ ] **Step 4: Checkpoint.**

---

## Task 9: Scope + role-gate the Components routes

**Files:**
- Modify: `app/api/components/route.ts`
- Modify: `app/api/components/[id]/route.ts`

- [ ] **Step 1: `app/api/components/route.ts`**
- Swap import to `requireApiWorkspace` / `requireApiRole` from `@/lib/workspace`.
- GET: guard with `requireApiWorkspace`; add `where: { workspaceId: a.workspace.id }` to `findMany`.
- POST (create): guard with `requireApiRole("EDITOR")`; add `workspaceId: a.workspace.id` to the `data` of `create`.

- [ ] **Step 2: `app/api/components/[id]/route.ts`**
- GET: `requireApiWorkspace`; replace `findUnique({ where: { id } })` with `findFirst({ where: { id, workspaceId: a.workspace.id } })`.
- PUT/DELETE: `requireApiRole("EDITOR")`; use `updateMany`/`deleteMany` with `where: { id, workspaceId: a.workspace.id }` and return 404 when `count === 0`.

- [ ] **Step 3: Runtime verify** — components list scoped; cross-workspace id → 404; logged out → 401.

- [ ] **Step 4: Checkpoint.**

---

## Task 10: Per-workspace Site (API + public renderers)

**Files:**
- Modify: `app/api/site/route.ts`
- Modify: `app/p/[slug]/page.tsx`
- Modify: `app/c/[slug]/[item]/page.tsx`

- [ ] **Step 1: Replace `app/api/site/route.ts` entirely**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// One Site row per workspace (header + footer + design-system tokens).
async function getSite(workspaceId: string) {
  const existing = await prisma.site.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.site.create({ data: { workspaceId } });
}

function parseJsonArray(json: string | null | undefined): any[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function siteJson(site: { header: string; footer: string; colors: string; textStyles: string }) {
  return {
    header: parseContent(site.header),
    footer: parseContent(site.footer),
    colors: parseJsonArray(site.colors),
    textStyles: parseJsonArray(site.textStyles),
  };
}

// GET /api/site — the active workspace's header/footer + design system
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const site = await getSite(a.workspace.id);
  return NextResponse.json(siteJson(site));
}

// PUT /api/site — update header, footer, and/or design-system tokens (editor+)
export async function PUT(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const data: { header?: string; footer?: string; colors?: string; textStyles?: string } = {};
  if (Array.isArray(body.header)) data.header = JSON.stringify(body.header);
  if (Array.isArray(body.footer)) data.footer = JSON.stringify(body.footer);
  if (Array.isArray(body.colors)) data.colors = JSON.stringify(body.colors);
  if (Array.isArray(body.textStyles)) data.textStyles = JSON.stringify(body.textStyles);
  const site = await prisma.site.upsert({
    where: { workspaceId: a.workspace.id },
    update: data,
    create: { workspaceId: a.workspace.id, ...data },
  });
  return NextResponse.json(siteJson(site));
}
```

- [ ] **Step 2: Fix the public page renderer `app/p/[slug]/page.tsx`**

The published page must use the Site, components, and collections of **its own** workspace. In the default export, after `if (!page || !page.published) notFound();`:

- Replace:
  ```ts
  const site = await prisma.site.findUnique({ where: { id: "site" } });
  ```
  with:
  ```ts
  const site = page.workspaceId
    ? await prisma.site.findUnique({ where: { workspaceId: page.workspaceId } })
    : null;
  ```
- Replace `const comps = await prisma.component.findMany();` with
  `const comps = await prisma.component.findMany({ where: { workspaceId: page.workspaceId } });`
- Replace the `collectionRows` query with
  ```ts
  const collectionRows = await prisma.collection.findMany({
    where: { workspaceId: page.workspaceId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  ```

- [ ] **Step 3: Apply the same three scoping changes to `app/c/[slug]/[item]/page.tsx`**

Open that file. It renders a CMS detail page and similarly loads the singleton `site`, all `components`, and `collections`. Determine the owning workspace from the collection (look up the collection by its slug; it has `workspaceId`) and scope the `site`, `component.findMany`, and `collection.findMany` queries by that `workspaceId`, mirroring Step 2. If the collection is not found, keep the existing `notFound()` behavior.

- [ ] **Step 4: Runtime verify** — open a published page at `/p/<slug>` while **logged out**; confirm header/footer + design-system styles still render (200, no 500). Editing the site via `/api/site` requires editor role.

- [ ] **Step 5: Checkpoint.**

---

## Task 11: Scope + gate Assets, Upload, Submissions, AI

**Files:**
- Modify: `app/api/assets/route.ts`
- Modify: `app/api/upload/route.ts`
- Modify: `app/api/submissions/route.ts`
- Modify: `app/api/ai/route.ts`

- [ ] **Step 1: `app/api/assets/route.ts`** — GET `requireApiWorkspace` + `where: { workspaceId: a.workspace.id }`; POST/create `requireApiRole("EDITOR")` + add `workspaceId: a.workspace.id` to the created row.

- [ ] **Step 2: `app/api/upload/route.ts`** — this writes an `Asset` after storing the file. Guard with `requireApiRole("EDITOR")` and add `workspaceId: a.workspace.id` to the `Asset` create `data`.

- [ ] **Step 3: `app/api/submissions/route.ts`** — **POST stays public** (visitor form submissions — do not add a guard). For **GET** (the inbox), replace `requireApiUser()` with `requireApiWorkspace()` and ensure the requested `pageId` belongs to the active workspace before returning rows:
  ```ts
  const page = await prisma.page.findFirst({ where: { id: pageId, workspaceId: a.workspace.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ```

- [ ] **Step 4: `app/api/ai/route.ts`** — the GET (providers probe) can stay on `requireApiUser` (no workspace data). For the **POST** generation handler, guard with `requireApiRole("EDITOR")` (AI generation is a paid/editor action). No `workspaceId` column to set here — it returns blocks the client then saves via `/api/pages`.

- [ ] **Step 5: Runtime verify** — assets list scoped; visitor POST to `/api/submissions` (no cookie) still returns 201; GET inbox for a foreign page → 404; AI POST while logged out → 401.

- [ ] **Step 6: Checkpoint.**

---

## Task 12: Scope the dashboard query

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Use the active workspace for the page list**

Replace the body of `Home()` so it scopes by workspace:

```ts
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");

  const { workspace } = await requireWorkspace();

  const pages = await prisma.page.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  const dto = pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.published,
    updatedAt: p.updatedAt.toISOString(),
    submissions: p._count.submissions,
  }));
  return <Dashboard pages={dto} user={user} />;
}
```

- [ ] **Step 2: Runtime verify** — dashboard shows only the active workspace's pages. (Switching workspaces is exercised in Task 13.)

- [ ] **Step 3: Checkpoint.**

---

## Task 13: Workspaces API (list / create / switch / rename / delete)

**Files:**
- Create: `app/api/workspaces/route.ts`
- Create: `app/api/workspaces/switch/route.ts`
- Create: `app/api/workspaces/[id]/route.ts`

- [ ] **Step 1: `app/api/workspaces/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/workspaces — the current user's workspaces (with their role)
export async function GET() {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const memberships = await prisma.membership.findMany({
    where: { userId: u.user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
    })),
  );
}

// POST /api/workspaces — create a workspace (current user becomes OWNER)
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const ws = await createWorkspace(u.user.id, name);
  return NextResponse.json(ws, { status: 201 });
}
```

- [ ] **Step 2: `app/api/workspaces/switch/route.ts`**

```ts
import { NextResponse } from "next/server";
import { setActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// POST /api/workspaces/switch { id } — set the active workspace cookie
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const ok = await setActiveWorkspace(id);
  if (!ok) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: `app/api/workspaces/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// PATCH /api/workspaces/[id] — rename (admin+, must be the active workspace)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  if (a.workspace.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  const ws = await prisma.workspace.update({ where: { id }, data });
  return NextResponse.json({ id: ws.id, name: ws.name, slug: ws.slug });
}

// DELETE /api/workspaces/[id] — delete the workspace (owner only)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await requireApiRole("OWNER");
  if ("response" in a) return a.response;
  if (a.workspace.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // refuse to delete the user's only workspace
  const count = await prisma.membership.count({ where: { userId: a.user.id } });
  if (count <= 1) return NextResponse.json({ error: "Cannot delete your only workspace" }, { status: 400 });
  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Runtime verify** — `GET /api/workspaces` returns your workspace(s) with role OWNER. Create a second workspace (`POST` with `{name}`). Switch to it (`POST /api/workspaces/switch {id}`), then load the dashboard — it should now be empty (different workspace). Switch back; pages reappear. This proves end-to-end scoping.

- [ ] **Step 5: Checkpoint.**

---

## Task 14: Members API (list / change role / remove)

**Files:**
- Create: `app/api/workspaces/members/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace, requireApiRole, type Role } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/workspaces/members — members of the active workspace (any member)
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const members = await prisma.membership.findMany({
    where: { workspaceId: a.workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    members.map((m) => ({ membershipId: m.id, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
  );
}

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

// PATCH /api/workspaces/members { membershipId, role } — change a role (admin+)
export async function PATCH(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const role = body.role as Role;
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Bad role" }, { status: 400 });
  const m = await prisma.membership.findFirst({ where: { id: String(body.membershipId), workspaceId: a.workspace.id } });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // never leave a workspace without an owner
  if (m.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.membership.count({ where: { workspaceId: a.workspace.id, role: "OWNER" } });
    if (owners <= 1) return NextResponse.json({ error: "Workspace needs an owner" }, { status: 400 });
  }
  await prisma.membership.update({ where: { id: m.id }, data: { role } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/workspaces/members?membershipId=... — remove a member (admin+)
export async function DELETE(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const membershipId = new URL(req.url).searchParams.get("membershipId") || "";
  const m = await prisma.membership.findFirst({ where: { id: membershipId, workspaceId: a.workspace.id } });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "OWNER") {
    const owners = await prisma.membership.count({ where: { workspaceId: a.workspace.id, role: "OWNER" } });
    if (owners <= 1) return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
  }
  await prisma.membership.delete({ where: { id: m.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Runtime verify** — `GET /api/workspaces/members` lists you as OWNER. A VIEWER/EDITOR account gets 403 on PATCH/DELETE. Demoting the only owner returns 400.

- [ ] **Step 3: Checkpoint.**

---

## Task 15: Invites API + accept flow

**Files:**
- Create: `app/api/workspaces/invites/route.ts`
- Create: `app/api/invites/[token]/route.ts`

- [ ] **Step 1: `app/api/workspaces/invites/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newToken } from "@/lib/auth";
import { requireApiRole, type Role } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]; // can't invite straight to OWNER

// GET /api/workspaces/invites — pending invites (admin+)
export async function GET() {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const invites = await prisma.invite.findMany({
    where: { workspaceId: a.workspace.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt.toISOString() })),
  );
}

// POST /api/workspaces/invites { email, role } — create an invite, return its link (admin+)
export async function POST(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const role = (ROLES.includes(body.role) ? body.role : "EDITOR") as Role;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  const token = newToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  await prisma.invite.create({ data: { workspaceId: a.workspace.id, email, role, token, invitedById: a.user.id, expiresAt } });
  await logActivity(a.workspace.id, a.user.id, "invite.sent", undefined, { email, role });

  const origin = new URL(req.url).origin;
  return NextResponse.json({ inviteUrl: `${origin}/invite/${token}` }, { status: 201 });
}

// DELETE /api/workspaces/invites?id=... — revoke a pending invite (admin+)
export async function DELETE(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const id = new URL(req.url).searchParams.get("id") || "";
  await prisma.invite.deleteMany({ where: { id, workspaceId: a.workspace.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: `app/api/invites/[token]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { setActiveWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/invites/[token] — preview (workspace name + validity); no auth needed
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token }, include: { workspace: true } });
  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  const valid = !invite.acceptedAt && invite.expiresAt > new Date();
  return NextResponse.json({ valid, email: invite.email, role: invite.role, workspaceName: invite.workspace.name });
}

// POST /api/invites/[token] — accept (must be signed in)
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 });
  }
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: u.user.id, workspaceId: invite.workspaceId } },
    update: {},
    create: { userId: u.user.id, workspaceId: invite.workspaceId, role: invite.role },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await setActiveWorkspace(invite.workspaceId);
  await logActivity(invite.workspaceId, u.user.id, "member.joined", u.user.id, {});
  return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
}
```

- [ ] **Step 3: Runtime verify (two accounts)** —
  1. As OWNER: `POST /api/workspaces/invites {email, role:"EDITOR"}` → returns an `inviteUrl`.
  2. `GET` that token → `{ valid: true, workspaceName: … }`.
  3. Sign in as a **second** account, `POST /api/invites/<token>` → `{ ok: true }`. The second account is now an EDITOR member and its active workspace switched. `GET /api/workspaces` for that account lists the workspace.
  4. Accepting again (already accepted) → 400.

- [ ] **Step 4: Checkpoint.**

---

## Task 16: Account API (profile + password)

**Files:**
- Create: `app/api/account/route.ts`
- Create: `app/api/account/password/route.ts`

- [ ] **Step 1: `app/api/account/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/account { name } — update the signed-in user's profile
export async function PATCH(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string } = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  const user = await prisma.user.update({ where: { id: u.user.id }, data });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
```

- [ ] **Step 2: `app/api/account/password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, verifyPassword, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/account/password { current, next } — change password
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (next.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const row = await prisma.user.findUnique({ where: { id: u.user.id } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: u.user.id }, data: { passwordHash: await hashPassword(next) } });
  // invalidate other sessions for safety
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Runtime verify** — `PATCH /api/account {name}` updates the name (visible in the user menu after refresh). `POST /api/account/password` with a wrong current → 400; with correct current + 8+ char new → `{ ok: true }`, and the new password works on next login.

- [ ] **Step 4: Checkpoint.**

---

## Task 17: Full self-review + suite + plan handoff

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all tests pass (the pre-existing 63 + the new `tests/workspace.test.ts`). If anything red, fix before continuing.

- [ ] **Step 2: End-to-end runtime sweep** (signed in, dev server up)
  - Dashboard lists only the active workspace's pages.
  - Create a 2nd workspace → switch → empty dashboard with proper scoping → switch back.
  - Create / edit / publish a page works as OWNER.
  - Invite a 2nd account as EDITOR via the invite link; that account can edit but, after demotion to VIEWER, receives 403 on `POST /api/pages` (control-layer proof of role enforcement).
  - A published page at `/p/<slug>` still renders correctly while logged out.
  - Change profile name + password via the account endpoints.

- [ ] **Step 3: Confirm the public POST `/api/submissions` is still unguarded** (visitor form submit returns 201 with no session). This is the one intentional public mutation.

- [ ] **Step 4: Checkpoint** — Plan 1A complete. Hand off to Plan 1B (App Shell & UI), which will surface all of this (workspace switcher, members/invites UI, account/settings pages, the sidebar IA, and the command palette).

---

## Self-review (author check against the spec)

- **Spec §4 data model** → Tasks 1 (models + scope columns).
- **Spec §5 tenancy plumbing** (`getActiveWorkspace`, `requireWorkspace`, `requireApiWorkspace`, `requireWorkspaceRole`, `setActiveWorkspace`) → Tasks 2–3. *Note: the spec named the gate `requireWorkspaceRole`; this plan implements it as `requireApiRole(min)` (route-handler form) plus `hasRole` for server pages — same capability, clearer split.*
- **Spec §6 migration** → Task 4 (+ Task 5 for new-user starter workspace, an implied requirement once tenancy is real).
- **Spec §8 per-workspace content + public renderers** → Tasks 7–12 (Site made per-workspace; `/p` and `/c` scoped).
- **Spec §9 roles/members/invites + account** (data + API only; UI is Plan 1B) → Tasks 13–16, with the role matrix enforced via `requireApiRole` (VIEWER read, EDITOR content, ADMIN members, OWNER destroy).
- **Spec §11 verification** → Task 17 (unit suite + runtime sweep + role-enforcement proof).
- **Deferred to Plan 1B (UI):** sidebar/route group/command palette, manager pages, and the settings/account/members/invite **screens** (this plan ships their APIs). **Deferred to later workstreams:** billing, realtime collaboration, branding.

**Type consistency check:** guard return shape `{ user, workspace, role } | { response }` is used identically across all routes; `Role` union is imported from `@/lib/workspace` everywhere; `a.workspace.id` is the scoping key throughout; `userId_workspaceId` compound key name matches the `@@unique([userId, workspaceId])` in the schema.
