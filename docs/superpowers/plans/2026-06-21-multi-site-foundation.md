# Multi-Site Foundation (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `Site` to a first-class entity so a workspace owns many sites, with all content (`Page`/`Collection`/`Asset`/`Component`) scoped to a `siteId` and page/collection slugs unique per-site.

**Architecture:** The app is pre-launch and its dev data is disposable, so this is a **clean reset**, not a careful migration: write the target schema directly (required `siteId` with `Site` relations + `onDelete: Cascade`; `@@unique([siteId, slug])`; drop `workspaceId` from content models), then `prisma db push --force-reset`. Workspace creation now also creates a default `Site` + home page, so onboarding produces a usable site. An "active site" is resolved from a `pc_site` cookie via a new `lib/auth/site.ts` layer mirroring `lib/auth/workspace.ts`, and every content API route is rescoped from `workspaceId` to `siteId`. Public multi-site *serving* (host → site) ships with the custom-domains plan; this plan keeps the default site rendering.

**Tech Stack:** Next.js 16 (App Router, route handlers, `proxy.ts`), Prisma 6 + SQLite, Vitest (node env), TypeScript strict, ESLint flat + Prettier.

**Spec:** `docs/superpowers/specs/2026-06-21-multi-site-model-design.md`

## Global Constraints

- **This is NOT vanilla Next.js** — read the relevant guide under `node_modules/next/dist/docs/` before using a Next API. Middleware is `proxy.ts`.
- **Dev data is disposable.** Reset with `npx prisma db push --force-reset` — no backfill scripts, no snapshots, no idempotency. Re-create a workspace by signing up after the reset.
- **Schema** is applied with `npx prisma db push` (the project uses `db push`, not migration files), then `npx prisma generate`.
- **Gate (run before every green commit):** `npx tsc --noEmit` && `npx vitest run` && `npx eslint .` && `npx prettier --check .`. Do **NOT** run `next build` while `next dev` is running.
- **Code style:** no `eslint-disable`; no `any` / `as any` / `!`; **no explanatory/justification comments** in code. Match existing style (double quotes, semicolons, 2-space).
- **Client HTTP** goes through `lib/api/client` (`api`) with paths from `lib/api/endpoints.ts` — add new endpoints there; never hardcode `/api/...`.
- **Atomic switch:** dropping `workspaceId` from content models makes the project's `tsc` red until the routes are rescoped. **Tasks 1–3 are one cohesive change** and share a single green commit at the end of Task 3 (the helper unit tests still run green along the way). Tasks 4+ are independently green.

---

## File Structure

**Create:**
- `lib/auth/site.ts` — active-site resolution + `requireApiSite`/`requireApiSiteRole`/`setActiveSite` (mirrors `lib/auth/workspace.ts`).
- `lib/sites/create.ts` — `createSite()` (a site + its blank home page), used by both onboarding and the sites API.
- `app/api/sites/route.ts` — `GET` list / `POST` create.
- `app/api/sites/[id]/route.ts` — `PATCH` rename / `DELETE` (cascades).
- `app/api/sites/switch/route.ts` — `POST` set active site.
- `app/api/sites/[id]/home/route.ts` — `PATCH` set `homePageId`.
- `tests/site-auth.test.ts`, `tests/site-slug.test.ts`, `tests/sites-api.test.ts`.

**Modify:**
- `prisma/schema.prisma` — the clean multi-site model.
- `lib/auth/workspace.ts` — `createWorkspace` also creates a default site.
- `lib/api/api-handler.ts` — generic `runGuarded` + `withSite`/`withSiteRole`.
- `lib/page-service.ts` — `uniqueSlug(siteId, title)`.
- `lib/api/endpoints.ts` — `endpoints.sites.*`.
- `app/api/pages/**`, `app/api/collections/**`, `app/api/assets/**`, `app/api/components/**`, `app/api/upload/route.ts`, `app/api/site/route.ts` — `workspaceId` → `siteId`.
- Builder server-loading + public render (`app/(app)/**`, editor loaders, `app/p/[slug]/page.tsx`, `app/c/[slug]/[item]/page.tsx`) — active/resolved site; fix slug lookups.

---

## Task 1: Clean multi-site schema + reset

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Rewrite the content + Site models**

In `prisma/schema.prisma`:

**`Site`** — make it first-class:

```prisma
model Site {
  id          String       @id @default(cuid())
  workspaceId String
  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  name        String       @default("Untitled site")
  handle      String       @default("main")
  homePageId  String?
  header      String       @default("[]")
  footer      String       @default("[]")
  colors      String       @default("[]")
  textStyles  String       @default("[]")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  pages       Page[]
  collections Collection[]
  assets      Asset[]
  components  Component[]

  @@unique([workspaceId, handle])
  @@index([workspaceId])
}
```

**`Page`** — drop `workspaceId`/`@@index([workspaceId])`; add the site relation; per-site slug:

```prisma
model Page {
  id              String   @id @default(cuid())
  title           String   @default("Untitled Page")
  slug            String
  content         String   @default("[]")
  theme           String   @default("{}")
  siteId          String
  site            Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  published       Boolean  @default(false)
  metaTitle       String?
  metaDescription String?
  ogImage         String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  submissions Submission[]
  versions    PageVersion[]
  thumbnail   PageThumbnail?

  @@unique([siteId, slug])
  @@index([siteId])
}
```

**`Collection`** — drop `workspaceId`; add the site relation; per-site slug:

```prisma
model Collection {
  id             String   @id @default(cuid())
  name           String   @default("Collection")
  slug           String
  fields         String   @default("[]")
  detailEnabled  Boolean  @default(false)
  detailTemplate String   @default("[]")
  siteId         String
  site           Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  items CollectionItem[]

  @@unique([siteId, slug])
  @@index([siteId])
}
```

**`Asset`** and **`Component`** — drop `workspaceId`/its index; add `siteId String` + `site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)` + `@@index([siteId])`.

**`Workspace`** — add the back-relation `sites Site[]` alongside `memberships`/`invites`.

- [ ] **Step 2: Reset the database to the new schema**

```bash
npx prisma db push --force-reset && npx prisma generate
```
Expected: "The SQLite database … was successfully reset." + "in sync" + "Generated Prisma Client". (All dev data is intentionally wiped.)

- [ ] **Step 3: Confirm the client typings updated**

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.site.findMany({where:{workspaceId:'x'}}).then(()=>{console.log('site relation ok'); return p.\$disconnect()})"
```
Expected: `site relation ok`.

> No commit yet — `tsc` is red across the API until Task 3. Continue.

---

## Task 2: Active-site layer, `createSite`, site-scoped `uniqueSlug`, default-site-on-onboarding

New code that compiles against the Task-1 schema. The helper unit tests run green here even though the whole-project `tsc` gate waits for Task 3.

**Files:**
- Create: `lib/auth/site.ts`, `lib/sites/create.ts`
- Modify: `lib/api/api-handler.ts`, `lib/page-service.ts`, `lib/auth/workspace.ts`
- Test: `tests/site-auth.test.ts`, `tests/site-slug.test.ts`

**Interfaces:**
- Produces: `resolveActiveSite(sites, wantedId)`, `getActiveSite()`, `requireApiSite()`, `requireApiSiteRole(min)`, `setActiveSite(id)`, types `SiteCtx`/`ActiveSite`; `withSite(fn)`/`withSiteRole(min, fn)`; `createSite(workspaceId, name) → { id, name, handle, homePageId }`; `uniqueSlug(siteId, title)`.
- Consumes: `getActiveWorkspace`, `hasRole`, `Role`, `WorkspaceCtx`, `createWorkspace` from `@/lib/auth/workspace`; `getCurrentUser` from `@/lib/auth/auth`.

- [ ] **Step 1: Write the failing test for the pure site resolver**

`tests/site-auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveActiveSite } from "@/lib/auth/site";

describe("resolveActiveSite", () => {
  const sites = [{ id: "a" }, { id: "b" }];
  it("returns null when there are no sites", () => {
    expect(resolveActiveSite([], "a")).toBeNull();
  });
  it("returns the wanted site when present", () => {
    expect(resolveActiveSite(sites, "b")?.id).toBe("b");
  });
  it("falls back to the first site for a missing/unknown id", () => {
    expect(resolveActiveSite(sites, undefined)?.id).toBe("a");
    expect(resolveActiveSite(sites, "zzz")?.id).toBe("a");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`@/lib/auth/site` missing)

Run: `npx vitest run tests/site-auth.test.ts`

- [ ] **Step 3: Implement `lib/auth/site.ts`**

```ts
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/auth";
import {
  getActiveWorkspace,
  hasRole,
  type Role,
  type WorkspaceCtx,
} from "@/lib/auth/workspace";

const SITE_COOKIE = "pc_site";
const jsonHeaders = { "content-type": "application/json" } as const;

export type ActiveSite = { id: string; name: string; handle: string; homePageId: string | null };
export type SiteCtx = WorkspaceCtx & { site: ActiveSite };

export function resolveActiveSite<T extends { id: string }>(
  sites: T[],
  wantedId: string | undefined,
): T | null {
  if (sites.length === 0) return null;
  return sites.find((s) => s.id === wantedId) ?? sites[0];
}

function res(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}

export const getActiveSite = cache(async (): Promise<SiteCtx | null> => {
  const ctx = await getActiveWorkspace();
  if (!ctx) return null;
  const sites = await prisma.site.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "asc" },
  });
  const jar = await cookies();
  const site = resolveActiveSite(sites, jar.get(SITE_COOKIE)?.value);
  if (!site) return null;
  return {
    ...ctx,
    site: { id: site.id, name: site.name, handle: site.handle, homePageId: site.homePageId },
  };
});

export async function requireApiSite(): Promise<SiteCtx | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: res(401, "Unauthorized") };
  const ctx = await getActiveSite();
  if (!ctx) return { response: res(403, "No site") };
  return ctx;
}

export async function requireApiSiteRole(min: Role): Promise<SiteCtx | { response: Response }> {
  const ctx = await requireApiSite();
  if ("response" in ctx) return ctx;
  if (!hasRole(ctx.role, min)) return { response: res(403, "Forbidden") };
  return ctx;
}

export async function setActiveSite(id: string): Promise<boolean> {
  const ctx = await getActiveWorkspace();
  if (!ctx) return false;
  const site = await prisma.site.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!site) return false;
  const jar = await cookies();
  jar.set(SITE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
```

- [ ] **Step 4: Run the resolver test — expect PASS**

Run: `npx vitest run tests/site-auth.test.ts`

- [ ] **Step 5: Add `withSite`/`withSiteRole` (generic `runGuarded`)**

Replace `lib/api/api-handler.ts` with:

```ts
import {
  requireApiRole,
  requireApiWorkspace,
  type Role,
  type WorkspaceCtx,
} from "@/lib/auth/workspace";
import { requireApiSite, requireApiSiteRole, type SiteCtx } from "@/lib/auth/site";
import { authzTotal } from "@/lib/observability";

export async function runGuarded<C extends { role: Role }>(
  guard: C | { response: Response },
  fn: (ctx: C) => Response | Promise<Response>,
): Promise<Response> {
  if ("response" in guard) {
    authzTotal.inc({ result: "denied", status: guard.response.status });
    return guard.response;
  }
  authzTotal.inc({ result: "allowed", role: guard.role });
  return fn(guard);
}

export async function withWorkspace(
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiWorkspace(), fn);
}

export async function withRole(
  min: Role,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiRole(min), fn);
}

export async function withSite(
  fn: (ctx: SiteCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiSite(), fn);
}

export async function withSiteRole(
  min: Role,
  fn: (ctx: SiteCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiSiteRole(min), fn);
}
```

- [ ] **Step 6: Make `uniqueSlug` site-scoped + write its test**

`tests/site-slug.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { uniqueSlug } from "@/lib/page-service";

const prisma = new PrismaClient();
const cleanup: { sites: string[]; ws: string[] } = { sites: [], ws: [] };

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: cleanup.ws } } });
  await prisma.$disconnect();
});

describe("uniqueSlug (site-scoped)", () => {
  it("suffixes within a site but allows the same slug in another site", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    cleanup.ws.push(ws.id);
    const a = await prisma.site.create({ data: { workspaceId: ws.id, name: "A", handle: "a" } });
    const b = await prisma.site.create({ data: { workspaceId: ws.id, name: "B", handle: "b" } });
    expect(await uniqueSlug(a.id, "About Us")).toBe("about-us");
    await prisma.page.create({ data: { title: "About", slug: "about-us", siteId: a.id } });
    expect(await uniqueSlug(a.id, "About Us")).toBe("about-us-2");
    expect(await uniqueSlug(b.id, "About Us")).toBe("about-us");
  });
});
```

In `lib/page-service.ts`, replace the existing `uniqueSlug` with:

```ts
export async function uniqueSlug(siteId: string, title: string): Promise<string> {
  const base = slugify(title) || "page";
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const existing = await prisma.page.findFirst({ where: { siteId, slug } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}
```
(If a `uniqueCollectionSlug` exists in the file, give it the same `(siteId, name)` shape against `prisma.collection.findFirst`.)

- [ ] **Step 7: Run the slug test — expect PASS**

Run: `npx vitest run tests/site-slug.test.ts`

- [ ] **Step 8: Implement `createSite` and wire it into `createWorkspace`**

`lib/sites/create.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

async function uniqueHandle(workspaceId: string, name: string): Promise<string> {
  const base = slugify(name) || "site";
  for (let n = 1; n < 1000; n++) {
    const handle = n === 1 ? base : `${base}-${n}`;
    const existing = await prisma.site.findFirst({ where: { workspaceId, handle } });
    if (!existing) return handle;
  }
  return `${base}-${Date.now()}`;
}

export async function createSite(workspaceId: string, name: string) {
  const cleanName = (name || "Untitled site").trim().slice(0, 80) || "Untitled site";
  const handle = await uniqueHandle(workspaceId, cleanName);
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.create({ data: { workspaceId, name: cleanName, handle } });
    const home = await tx.page.create({
      data: { title: "Home", slug: "home", siteId: site.id, published: false },
    });
    await tx.site.update({ where: { id: site.id }, data: { homePageId: home.id } });
    return { id: site.id, name: site.name, handle: site.handle, homePageId: home.id };
  });
}
```

In `lib/auth/workspace.ts`, make `createWorkspace` create a default site after the workspace+membership transaction (add the import `import { createSite } from "@/lib/sites/create";`):

```ts
export async function createWorkspace(userId: string, name: string): Promise<ActiveWorkspace> {
  const cleanName = (name || "Workspace").trim().slice(0, 80) || "Workspace";
  const slug = await uniqueWorkspaceSlug(cleanName);
  const ws = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({ data: { name: cleanName, slug } });
    await tx.membership.create({ data: { userId, workspaceId: created.id, role: "OWNER" } });
    return created;
  });
  await createSite(ws.id, "Main site");
  return { id: ws.id, name: ws.name, slug: ws.slug };
}
```

> Still no whole-project commit — routes are next. The two helper tests are green.

---

## Task 3: Rescope the content APIs + builder loading → GREEN

The mechanical sweep: `withWorkspace`→`withSite`, `withRole`→`withSiteRole`, callback `ws`→`ctx`, content filters `workspaceId: ws.workspace.id`→`siteId: ctx.site.id`, `uniqueSlug(title)`→`uniqueSlug(ctx.site.id, title)`. `logActivity` still wants the workspace id — use `ctx.workspace.id`. Slug `findUnique({ where: { slug } })` → `findFirst({ where: { slug } })` (correct for the single default site; host→site disambiguation arrives with custom domains).

**Files (modify):** all of `app/api/pages/**`, `app/api/collections/**`, `app/api/assets/**`, `app/api/components/**`, `app/api/upload/route.ts`, `app/api/site/route.ts`, plus the builder server components and public render pages.

- [ ] **Step 1: Transform `app/api/pages/route.ts` (canonical example)**

```ts
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/page-service";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, created } from "@/lib/api/api-response";
import { parseBody, createPageSchema } from "@/lib/api/schemas";
import { logActivity } from "@/lib/activity";
import { instrumentApi, timeDb } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return instrumentApi("/api/pages", req, () =>
    withSite(async (ctx) => {
      const pages = await timeDb("page.findMany", () =>
        prisma.page.findMany({ where: { siteId: ctx.site.id }, orderBy: { updatedAt: "desc" } }),
      );
      return json(pages);
    }),
  );
}

export async function POST(req: Request) {
  return instrumentApi("/api/pages", req, () =>
    withSiteRole("EDITOR", async (ctx) => {
      const parsed = await parseBody(req, createPageSchema);
      if ("response" in parsed) return parsed.response;
      const title = (parsed.data.title || "Untitled Page").slice(0, 120);
      const slug = await uniqueSlug(ctx.site.id, title);
      const content = JSON.stringify(parsed.data.content ?? []);
      const page = await prisma.page.create({
        data: { title, slug, content, siteId: ctx.site.id },
      });
      await logActivity(ctx.workspace.id, ctx.user.id, "page.created", page.id, { title });
      return created(page);
    }),
  );
}
```

- [ ] **Step 2: Apply the same transform to every other content route**

For each file under `app/api/pages/**` (`[id]`, `[id]/publish`, `[id]/versions`, `[id]/versions/[versionId]`, `[id]/thumbnail`), `app/api/collections/**` (`route`, `[id]`, `[id]/items`, `[id]/items/[itemId]`), `app/api/assets/**`, `app/api/components/**`, and `app/api/upload/route.ts`: read it, then apply the same rename (`withWorkspace`→`withSite`, `withRole`→`withSiteRole`, `ws`→`ctx`, content `where`/`data` `workspaceId: ws.workspace.id`→`siteId: ctx.site.id`, by-id lookups `{ id, workspaceId: ws.workspace.id }`→`{ id, siteId: ctx.site.id }`, `uniqueSlug(title)`→`uniqueSlug(ctx.site.id, title)`). For item routes, load the parent collection with `findFirst({ where: { id, siteId: ctx.site.id } })` (404 if missing) before touching items. Keep `ctx.workspace.id` only for `logActivity`. Run `npx prettier --write` on each.

- [ ] **Step 3: Point `app/api/site/route.ts` at the active site**

Change its `GET` to read the **active site's** `header/footer/colors/textStyles` (`withSite`, load by `ctx.site.id`), and `PUT` to update `where: { id: ctx.site.id }` (`withSiteRole("EDITOR")`). Remove any `findFirst({ where: { workspaceId } })` site-singleton logic — there is no singleton now.

- [ ] **Step 4: Fix builder server-loading + public slug lookups**

```bash
grep -rn "findUnique({ where: { slug" app lib components
grep -rln "requireWorkspace()\|workspaceId:" "app/(app)" components/editor components/dashboard
```
For each printed file: change `page`/`collection` `findUnique({ where: { slug } })` → `findFirst({ where: { slug } })`; in builder server components, swap `requireWorkspace()` + `prisma.page.findMany({ where: { workspaceId } })` for `getActiveSite()` (from `@/lib/auth/site`) + `where: { siteId: ctx.site.id }`, redirecting to `/onboarding` when it's null. Apply the same to collection/asset/component server loads.

- [ ] **Step 5: Run the FULL gate (first green checkpoint)**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`
Expected: tsc 0 errors; **all tests pass**; eslint clean; prettier clean. (If `tsc` flags a stray `workspaceId`, grep for it and finish the rename.)

- [ ] **Step 6: Smoke-test onboarding (the reset wiped all data)**

Start `npm run dev`, sign up, and confirm a workspace + a "Main site" with a "Home" page exist and the dashboard loads.

- [ ] **Step 7: Commit the whole model switch (Tasks 1–3)**

```bash
git add -A
git reset -q -- prisma/dev.db .idea
git commit -m "feat(sites): promote Site to first-class; scope content to siteId

Clean reset to the multi-site model: Site relations + cascade, required siteId,
@@unique([siteId, slug]); active-site guards (lib/auth/site.ts + withSite); a
default site is created with each workspace; content APIs scoped to the active site."
```

---

## Task 4: `/api/sites` CRUD + switch

`createSite` already exists (Task 2). This adds the routes + registry. Deletion just cascades via the `Site` relations.

**Files:**
- Create: `app/api/sites/route.ts`, `app/api/sites/[id]/route.ts`, `app/api/sites/switch/route.ts`, `app/api/sites/[id]/home/route.ts`
- Modify: `lib/api/endpoints.ts`
- Test: `tests/sites-api.test.ts`

- [ ] **Step 1: Write the failing test for `createSite` behavior**

`tests/sites-api.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSite } from "@/lib/sites/create";

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("createSite", () => {
  it("creates a site with a home page and a workspace-unique handle", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const a = await createSite(ws.id, "Marketing");
    const b = await createSite(ws.id, "Marketing");
    expect(a.handle).toBe("marketing");
    expect(b.handle).toBe("marketing-2");
    expect(a.homePageId).toBeTruthy();
    const home = await prisma.page.findFirst({ where: { id: a.homePageId ?? "" } });
    expect(home?.siteId).toBe(a.id);
  });
});
```

- [ ] **Step 2: Run it — expect PASS** (`createSite` exists from Task 2)

Run: `npx vitest run tests/sites-api.test.ts`
(If it fails, fix `createSite` from Task 2 before continuing.)

- [ ] **Step 3: Add the route handlers**

`app/api/sites/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created } from "@/lib/api/api-response";
import { createSite } from "@/lib/sites/create";

export const dynamic = "force-dynamic";

export async function GET() {
  return withWorkspace(async (ws) => {
    const sites = await prisma.site.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { createdAt: "asc" },
    });
    return json(sites);
  });
}

export async function POST(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const site = await createSite(ws.workspace.id, String(body?.name ?? ""));
    return created(site);
  });
}
```

`app/api/sites/[id]/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, badRequest, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRole("ADMIN", async (ws) => {
    const site = await prisma.site.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!site) return notFound();
    const body = await req.json().catch(() => ({}));
    const updated = await prisma.site.update({
      where: { id },
      data: { name: String(body?.name ?? site.name).slice(0, 80) },
    });
    return json(updated);
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRole("ADMIN", async (ws) => {
    const count = await prisma.site.count({ where: { workspaceId: ws.workspace.id } });
    if (count <= 1) return badRequest("A workspace must keep at least one site");
    const site = await prisma.site.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!site) return notFound();
    await prisma.site.delete({ where: { id } });
    return json({ ok: true });
  });
}
```

`app/api/sites/switch/route.ts`:

```ts
import { withWorkspace } from "@/lib/api/api-handler";
import { json, badRequest } from "@/lib/api/api-response";
import { setActiveSite } from "@/lib/auth/site";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withWorkspace(async () => {
    const body = await req.json().catch(() => ({}));
    const ok = await setActiveSite(String(body?.id ?? ""));
    return ok ? json({ ok: true }) : badRequest("Unknown site");
  });
}
```

`app/api/sites/[id]/home/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, badRequest, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRole("EDITOR", async (ws) => {
    const site = await prisma.site.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!site) return notFound();
    const body = await req.json().catch(() => ({}));
    const page = await prisma.page.findFirst({ where: { id: String(body?.pageId ?? ""), siteId: id } });
    if (!page) return badRequest("Page not in this site");
    const updated = await prisma.site.update({ where: { id }, data: { homePageId: page.id } });
    return json(updated);
  });
}
```

> **Check `lib/api/api-response.ts` first:** this task uses `json`, `created`, `badRequest`, `notFound`. If a helper name differs, use the actual exports (the ai/route handler uses `json`, `badRequest`, `error` — confirm and adjust).

- [ ] **Step 4: Register endpoints**

In `lib/api/endpoints.ts`, add to the `endpoints` object:

```ts
  sites: {
    list: "/api/sites",
    byId: (id: string) => `/api/sites/${id}`,
    switch: "/api/sites/switch",
    home: (id: string) => `/api/sites/${id}/home`,
  },
```

- [ ] **Step 5: Run the gate + commit**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`
Expected: all green.

```bash
git add app/api/sites lib/api/endpoints.ts tests/sites-api.test.ts
git commit -m "feat(api): /api/sites CRUD + switch"
```

---

## Task 5: Integration verification

- [ ] **Step 1: Multi-site smoke test (dev server + a session cookie)**

Create + switch a second site, confirm isolation:

```bash
curl -X POST localhost:3000/api/sites -H 'content-type: application/json' -d '{"name":"Blog"}' --cookie "<session+pc_ws>"
curl -X POST localhost:3000/api/sites/switch -H 'content-type: application/json' -d '{"id":"<new-site-id>"}' --cookie "<session+pc_ws>"
curl localhost:3000/api/pages --cookie "<session+pc_ws+pc_site>"
```
Expected: the new site has only its "Home" page; `GET /api/pages` after switching returns just that site's pages. Switch back → the first site's pages return. (Serving the second site at a clean public URL is the custom-domains plan.)

- [ ] **Step 2: Final gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`
Expected: all green. No further commit needed if nothing changed.

---

## Out of scope (follow-up plans)

- **Builder UI for sites (P2):** site switcher in the app shell, a sites dashboard, create/rename/delete + "set home page" controls — consumes `endpoints.sites.*`.
- **Public multi-site serving:** host → site routing (`proxy.ts` + `resolveHostSite`) ships with the **custom-domains** plan; until then only the active/default site serves at clean public URLs.

---

## Self-review notes

- **Spec coverage:** §3 data model → Task 1; §3.3 explicit home page → `createSite` (Tasks 2/4) sets it; §4 "migration" → replaced by the clean reset (Task 1) per the owner's go-ahead to wipe dev data; §5 access control (`requireApiSite`) → Task 2; §7 routing/slug → Tasks 2–3; §9 testing → Tasks 2/4. §6 builder UX deferred to P2 (flagged).
- **Type consistency:** `uniqueSlug(siteId, title)` and `createSite(workspaceId, name) → { id, name, handle, homePageId }` (Task 2) are used with those exact shapes in Tasks 3–4; `SiteCtx`/`withSite`/`withSiteRole` (Task 2) are used verbatim in Task 3.
- **No placeholders:** every code step shows real code; the route sweep gives the canonical file + an explicit mechanical rename rule.
- **Confirm at execution:** exact `lib/api/api-response.ts` exports (`json`/`created`/`badRequest`/`notFound`/`error`) — adjust Task 4 to the real names.
