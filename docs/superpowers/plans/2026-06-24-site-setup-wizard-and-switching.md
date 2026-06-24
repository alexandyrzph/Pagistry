# Site Setup Wizard, Switching & Editor Page Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After onboarding, prompt the user to explicitly create a workspace + site (name, image, favicon, optional domain), let them switch sites from the sidebar, and edit page slugs + web settings from the editor.

**Architecture:** Stop auto-creating a workspace/site at signup. A server gate in the `(app)` layout redirects users with no workspace-or-site to a full-screen `/setup` wizard whose step forms are reused as sidebar "New site / New workspace" modals. Pages stay siteId-scoped; a new `SiteSwitcher` sits under the workspace switcher. The editor's SEO tab becomes a "Page" panel (slug + SEO + status/homepage + site shortcuts).

**Tech Stack:** Next.js (custom fork — see Global Constraints), Prisma + Postgres, Zustand (editor store), Vitest, axios (`lib/api/client`), Tailwind, `components/ui` react-aria primitives.

## Global Constraints

- **Custom Next.js.** APIs may differ from upstream — read `node_modules/next/dist/docs/` before using an unfamiliar Next API (per `AGENTS.md`).
- **HTTP** goes through axios `api` (`lib/api/client.ts`) + the endpoint registry (`lib/api/endpoints.ts`). No hardcoded endpoint URLs. axios rejects on non-2xx.
- **Admin/builder UI** uses `components/ui` primitives + `dialog-provider` (`useConfirm`/`useAlert`), mirrors `CollectionManager`, and includes delete actions. Never `window.prompt/alert/confirm` or raw HTML forms for admin actions.
- **No justification/explanatory comments** in diffs.
- **Lint + format are part of the gate:** `npm run lint` and `npm run format:check` must pass. react-hooks compiler rules are errors.
- **Do NOT run `next build` while `next dev` is running** (shared `.next/` corrupts dev). The gate is `npx tsc --noEmit` + `npx vitest run` + `npm run lint` + `npm run format:check`.
- **Do NOT `git push`** — commit locally only.
- **Integration tests + migrations** need the dev Postgres (Homebrew `postgresql@16` on port **5433**, role/db `pagistry`); it should already be running via brew-services. `DATABASE_URL` in `.env` points at it.

---

## Milestone 1 — Setup foundation & first-run wizard

Removes auto-create, adds the schema fields, decouples the creation helpers, gates onboarding into `/setup`, and ships the wizard + favicon. After M1, a brand-new user is forced through "create workspace + site," and an uploaded favicon appears on the published site.

### Task M1.1: Schema — site branding + page noindex

**Files:**
- Modify: `prisma/schema.prisma:11-36` (Site), `prisma/schema.prisma:38-59` (Page)
- Test: `tests/schema-branding.test.ts` (create)

**Interfaces:**
- Produces: `Site.logoUrl: string | null`, `Site.faviconUrl: string | null`, `Page.noindex: boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema-branding.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const cleanup: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: cleanup } } });
  await prisma.$disconnect();
});

describe("site branding + page noindex columns", () => {
  it("persists logoUrl, faviconUrl and noindex", async () => {
    const ws = await prisma.workspace.create({
      data: { name: "B", slug: `brand-${Date.now()}` },
    });
    cleanup.push(ws.id);
    const site = await prisma.site.create({
      data: { workspaceId: ws.id, name: "S", handle: "s", logoUrl: "/l.png", faviconUrl: "/f.ico" },
    });
    const page = await prisma.page.create({
      data: { title: "P", slug: "p", siteId: site.id, noindex: true },
    });
    expect(site.logoUrl).toBe("/l.png");
    expect(site.faviconUrl).toBe("/f.ico");
    expect(page.noindex).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/schema-branding.test.ts`
Expected: FAIL — TypeScript/Prisma error, `logoUrl`/`faviconUrl`/`noindex` do not exist on the create input.

- [ ] **Step 3: Add the columns**

In `prisma/schema.prisma`, inside `model Site` (after `homePageId String?`):

```prisma
  logoUrl     String?
  faviconUrl  String?
```

Inside `model Page` (after `ogImage String?`):

```prisma
  noindex         Boolean  @default(false)
```

- [ ] **Step 4: Migrate + regenerate the client**

Run: `npx prisma migrate dev --name site-branding-page-noindex && npx prisma generate`
Expected: migration applies cleanly; client regenerates.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/schema-branding.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/schema-branding.test.ts
git commit -m "feat(schema): add Site.logoUrl/faviconUrl and Page.noindex"
```

### Task M1.2: Refactor `createSite` to a payload object + branding

**Files:**
- Modify: `lib/sites/create.ts`
- Modify: `app/api/sites/route.ts:18-26` (caller)
- Modify: `lib/auth/workspace.ts:134` (caller — temporary; removed in M1.3)
- Test: `tests/sites-api.test.ts` (update existing calls)

**Interfaces:**
- Produces: `createSite({ workspaceId, name, logoUrl?, faviconUrl? }, db = prisma) => Promise<{ id, name, handle, homePageId }>`

- [ ] **Step 1: Update the tests to the new signature (failing)**

In `tests/sites-api.test.ts`, replace the three `createSite(...)` calls:
- Line ~20: `const result = await createSite({ workspaceId: ws.id, name: "Main site" });`
- Line ~41: `await createSite({ workspaceId: ws.id, name: "TX site" }, tx);`
- Line ~57: `await createSite({ workspaceId: ws.id, name: "Rollback site" }, tx);`

Add a branding assertion to the first test, after the existing `expect(result.homePageId).toBeTruthy();`:

```ts
    const branded = await createSite({
      workspaceId: ws.id,
      name: "Branded",
      logoUrl: "/logo.png",
      faviconUrl: "/fav.ico",
    });
    const brandedSite = await prisma.site.findUniqueOrThrow({ where: { id: branded.id } });
    expect(brandedSite.logoUrl).toBe("/logo.png");
    expect(brandedSite.faviconUrl).toBe("/fav.ico");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sites-api.test.ts`
Expected: FAIL — `createSite` still expects positional args.

- [ ] **Step 3: Rewrite `createSite`**

Replace the body of `lib/sites/create.ts` from `export async function createSite` onward:

```ts
export async function createSite(
  {
    workspaceId,
    name,
    logoUrl,
    faviconUrl,
  }: { workspaceId: string; name: string; logoUrl?: string | null; faviconUrl?: string | null },
  db: Db = prisma,
) {
  const cleanName = (name || "Untitled site").trim().slice(0, 80) || "Untitled site";
  const handle = await uniqueHandle(workspaceId, cleanName, db);
  const site = await db.site.create({
    data: { workspaceId, name: cleanName, handle, logoUrl: logoUrl ?? null, faviconUrl: faviconUrl ?? null },
  });
  const home = await db.page.create({
    data: { title: "Home", slug: "home", siteId: site.id, published: false },
  });
  await db.site.update({ where: { id: site.id }, data: { homePageId: home.id } });
  return { id: site.id, name: site.name, handle: site.handle, homePageId: home.id };
}
```

- [ ] **Step 4: Update the two production callers**

`app/api/sites/route.ts` lines 20-23 → the `createSite` call becomes:

```ts
    const body = await req.json().catch(() => ({}));
    const site = await prisma.$transaction((tx) =>
      createSite(
        {
          workspaceId: ws.workspace.id,
          name: String(body?.name ?? ""),
          logoUrl: body?.logoUrl ?? null,
          faviconUrl: body?.faviconUrl ?? null,
        },
        tx,
      ),
    );
```

`lib/auth/workspace.ts:134` → `await createSite({ workspaceId: created.id, name: "Main site" }, tx);`

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/sites-api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/sites/create.ts app/api/sites/route.ts lib/auth/workspace.ts tests/sites-api.test.ts
git commit -m "refactor(sites): createSite takes a payload object + branding fields"
```

### Task M1.3: Refactor `createWorkspace` to a payload object + decouple from site creation

**Files:**
- Modify: `lib/auth/workspace.ts` (signature, body, no `createSite`, `uniqueWorkspaceSlug(name, db)`)
- Modify: `app/api/workspaces/route.ts:35` (caller)
- Test: `tests/create-workspace.test.ts` (create)

**Interfaces:**
- Consumes: `createSite` (M1.2).
- Produces: `createWorkspace({ userId, name, logoUrl? }, db = prisma) => Promise<{ id, name, slug }>` — creates **only** workspace + OWNER membership, **no** site.

- [ ] **Step 1: Write the failing test**

```ts
// tests/create-workspace.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createWorkspace } from "@/lib/auth/workspace";

const prisma = new PrismaClient();
const users: string[] = [];
const wss: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wss } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("createWorkspace", () => {
  it("creates a workspace + OWNER membership but no site", async () => {
    const user = await prisma.user.create({ data: { email: `cw-${Date.now()}@t.dev`, name: "T" } });
    users.push(user.id);

    const ws = await createWorkspace({ userId: user.id, name: "Acme", logoUrl: "/w.png" });
    wss.push(ws.id);

    const row = await prisma.workspace.findUniqueOrThrow({ where: { id: ws.id } });
    expect(row.logoUrl).toBe("/w.png");

    const membership = await prisma.membership.findFirstOrThrow({ where: { workspaceId: ws.id } });
    expect(membership.role).toBe("OWNER");

    const sites = await prisma.site.findMany({ where: { workspaceId: ws.id } });
    expect(sites).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/create-workspace.test.ts`
Expected: FAIL — old `createWorkspace(userId, name)` signature + it still creates a "Main site".

- [ ] **Step 3: Rewrite `createWorkspace` and `uniqueWorkspaceSlug`**

In `lib/auth/workspace.ts`, add the `Db` type near the top imports:

```ts
import type { Prisma } from "@prisma/client";
type Db = Prisma.TransactionClient | typeof prisma;
```

Remove the now-unused `import { createSite } from "@/lib/sites/create";` line.

Replace `uniqueWorkspaceSlug` and `createWorkspace`:

```ts
async function uniqueWorkspaceSlug(name: string, db: Db = prisma): Promise<string> {
  let n = 1;
  while (n < 1000) {
    const slug = slugCandidate(name, n);
    const existing = await db.workspace.findUnique({ where: { slug } });
    if (!existing) return slug;
    n++;
  }
  return `${slugCandidate(name, 1)}-${Date.now()}`;
}

export async function createWorkspace(
  { userId, name, logoUrl }: { userId: string; name: string; logoUrl?: string | null },
  db: Db = prisma,
): Promise<ActiveWorkspace> {
  const cleanName = (name || "Workspace").trim().slice(0, 80) || "Workspace";
  const slug = await uniqueWorkspaceSlug(cleanName, db);
  const created = await db.workspace.create({
    data: { name: cleanName, slug, logoUrl: logoUrl ?? null },
  });
  await db.membership.create({ data: { userId, workspaceId: created.id, role: "OWNER" } });
  return { id: created.id, name: created.name, slug: created.slug };
}
```

- [ ] **Step 4: Update the `/api/workspaces` caller**

`app/api/workspaces/route.ts:35` → `const ws = await createWorkspace({ userId: u.user.id, name, logoUrl: body?.logoUrl ?? null });`

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/create-workspace.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/auth/workspace.ts app/api/workspaces/route.ts tests/create-workspace.test.ts
git commit -m "refactor(workspace): createWorkspace takes a payload + no longer creates a site"
```

### Task M1.4: Stop auto-creating a workspace at signup + OAuth, and relax the last-one delete guards

**Files:**
- Modify: `app/api/auth/signup/route.ts:37-40`
- Modify: `lib/auth/oauth-account.ts:50`
- Modify: `app/api/sites/[id]/route.ts:24-25` (drop "must keep at least one site")
- Modify: `app/api/workspaces/[id]/route.ts:28-29` (drop "cannot delete your only workspace")

**Interfaces:**
- Consumes: nothing new. Behavioral change verified by M1.5's gate test (a user with no membership, or a workspace with no site, lands in `/setup`). Relaxing the guards lets a user delete their last site/workspace; the gate then re-drives them through `/setup`.

- [ ] **Step 1: Remove the signup auto-create**

In `app/api/auth/signup/route.ts`, delete the `createWorkspace` import (line 4) and replace lines 37-40 with:

```ts
  await createSession(user.id);
  return NextResponse.json({ ok: true, onboarded: false });
```

- [ ] **Step 2: Remove the OAuth auto-create**

In `lib/auth/oauth-account.ts`, delete line 50 (`await createWorkspace(...)`) and remove the now-unused `createWorkspace` (and `oauthWorkspaceName`, if it becomes unused — check with the next step) imports.

- [ ] **Step 3: Relax the site delete guard**

In `app/api/sites/[id]/route.ts` `DELETE`, remove the two guard lines:

```ts
    const count = await prisma.site.count({ where: { workspaceId: ws.workspace.id } });
    if (count <= 1) return badRequest("A workspace must keep at least one site");
```

If `badRequest` is now unused in that file, drop it from the `@/lib/api/api-response` import.

- [ ] **Step 4: Relax the workspace delete guard**

In `app/api/workspaces/[id]/route.ts` `DELETE`, remove the two guard lines:

```ts
    const count = await prisma.membership.count({ where: { userId: ws.user.id } });
    if (count <= 1) return badRequest("Cannot delete your only workspace");
```

If `badRequest` is now unused in that file, drop it from the import.

- [ ] **Step 5: Verify build + lint (no unused imports)**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS, no "unused variable" errors. If `oauthWorkspaceName` is now unused, remove its import and (if local) its definition.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/signup/route.ts lib/auth/oauth-account.ts app/api/sites/\[id\]/route.ts app/api/workspaces/\[id\]/route.ts
git commit -m "feat(auth): stop auto-creating a workspace and allow zero-state (gate re-drives setup)"
```

### Task M1.5: The setup gate

**Files:**
- Create: `lib/auth/setup-gate.ts`
- Modify: `app/(app)/layout.tsx:14-15`
- Modify: `lib/auth/workspace.ts:75` and `lib/auth/site.ts:48` (redirect fallback `/onboarding` → `/setup`)
- Test: `tests/setup-gate.test.ts` (create)

**Interfaces:**
- Produces: `needsSetup({ hasWorkspace: boolean; siteCount: number }) => boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/setup-gate.test.ts
import { describe, it, expect } from "vitest";
import { needsSetup } from "@/lib/auth/setup-gate";

describe("needsSetup", () => {
  it("is true when the user has no workspace", () => {
    expect(needsSetup({ hasWorkspace: false, siteCount: 0 })).toBe(true);
  });
  it("is true when the workspace has zero sites", () => {
    expect(needsSetup({ hasWorkspace: true, siteCount: 0 })).toBe(true);
  });
  it("is false once a workspace has at least one site", () => {
    expect(needsSetup({ hasWorkspace: true, siteCount: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/setup-gate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the predicate**

```ts
// lib/auth/setup-gate.ts
export function needsSetup(s: { hasWorkspace: boolean; siteCount: number }): boolean {
  return !s.hasWorkspace || s.siteCount === 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/setup-gate.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the gate into the app layout**

In `app/(app)/layout.tsx`, replace lines 14-15 (`const ctx = await getActiveWorkspace(); if (!ctx) redirect("/onboarding");`) with:

```ts
  const ctx = await getActiveWorkspace();
  const siteCount = ctx
    ? await prisma.site.count({ where: { workspaceId: ctx.workspace.id } })
    : 0;
  if (needsSetup({ hasWorkspace: !!ctx, siteCount })) redirect("/setup");
```

Add the import at the top: `import { needsSetup } from "@/lib/auth/setup-gate";`

(`prisma` is already imported in this file.) Note `ctx` is used again below at line 37 (`activeWorkspaceId={ctx.workspace.id}`); after this gate `ctx` is guaranteed non-null, so add a `if (!ctx) redirect("/setup");` immediately after the `needsSetup` check to satisfy the type narrower:

```ts
  if (needsSetup({ hasWorkspace: !!ctx, siteCount })) redirect("/setup");
  if (!ctx) redirect("/setup");
```

- [ ] **Step 6: Point the helper fallbacks at `/setup`**

In `lib/auth/workspace.ts` `requireWorkspace` (line ~75) change `redirect("/onboarding")` → `redirect("/setup")`.
In `lib/auth/site.ts` `requireSite` (line ~48) change `redirect("/onboarding")` → `redirect("/setup")`.

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/auth/setup-gate.ts app/\(app\)/layout.tsx lib/auth/workspace.ts lib/auth/site.ts tests/setup-gate.test.ts
git commit -m "feat(auth): gate users with no workspace/site into /setup"
```

### Task M1.6: `persistActiveContext` + `POST /api/setup` + endpoint + extended create routes

**Files:**
- Modify: `lib/auth/site.ts` (add `persistActiveContext`)
- Create: `app/api/setup/route.ts`
- Modify: `lib/api/endpoints.ts` (add `setup`)
- Modify: `app/api/workspaces/route.ts` (already accepts `logoUrl` via M1.3 — confirm) and `app/api/sites/route.ts` (already extended in M1.2 — confirm)
- Test: `tests/setup-api.test.ts` (create)

**Interfaces:**
- Consumes: `createWorkspace` (M1.3), `createSite` (M1.2).
- Produces: `persistActiveContext(workspaceId, siteId) => Promise<void>`; `POST /api/setup` body `{ workspace: { name: string; logoUrl?: string } | null, site: { name: string; logoUrl?: string; faviconUrl?: string } }` → `201 { workspaceId, siteId }`; `endpoints.setup = "/api/setup"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/setup-api.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runSetup } from "@/lib/setup/run-setup";

const prisma = new PrismaClient();
const users: string[] = [];
const wss: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wss } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("runSetup", () => {
  it("creates a workspace + site for a fresh user", async () => {
    const user = await prisma.user.create({ data: { email: `s-${Date.now()}@t.dev`, name: "T" } });
    users.push(user.id);

    const r = await runSetup(user.id, {
      workspace: { name: "Acme", logoUrl: "/w.png" },
      site: { name: "Marketing", faviconUrl: "/f.ico" },
    });
    wss.push(r.workspaceId);

    const sites = await prisma.site.findMany({ where: { workspaceId: r.workspaceId } });
    expect(sites).toHaveLength(1);
    expect(sites[0].id).toBe(r.siteId);
    expect(sites[0].faviconUrl).toBe("/f.ico");
  });

  it("adds a site to the existing workspace when workspace is null", async () => {
    const user = await prisma.user.create({ data: { email: `s2-${Date.now()}@t.dev`, name: "T" } });
    users.push(user.id);
    const first = await runSetup(user.id, { workspace: { name: "Solo" }, site: { name: "A" } });
    wss.push(first.workspaceId);

    const second = await runSetup(user.id, { workspace: null, site: { name: "B" } });
    expect(second.workspaceId).toBe(first.workspaceId);
    const sites = await prisma.site.findMany({ where: { workspaceId: first.workspaceId } });
    expect(sites.map((s) => s.name).sort()).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/setup-api.test.ts`
Expected: FAIL — `@/lib/setup/run-setup` not found.

- [ ] **Step 3: Implement the transactional core**

```ts
// lib/setup/run-setup.ts
import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/lib/auth/workspace";
import { createSite } from "@/lib/sites/create";

export type SetupInput = {
  workspace: { name: string; logoUrl?: string | null } | null;
  site: { name: string; logoUrl?: string | null; faviconUrl?: string | null };
};

export async function runSetup(
  userId: string,
  input: SetupInput,
): Promise<{ workspaceId: string; siteId: string }> {
  let workspaceId = "";
  if (!input.workspace) {
    const m = await prisma.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (!m) throw new Error("no_workspace");
    workspaceId = m.workspaceId;
  }
  return prisma.$transaction(async (tx) => {
    if (input.workspace) {
      const ws = await createWorkspace(
        { userId, name: input.workspace.name, logoUrl: input.workspace.logoUrl ?? null },
        tx,
      );
      workspaceId = ws.id;
    }
    const site = await createSite(
      {
        workspaceId,
        name: input.site.name,
        logoUrl: input.site.logoUrl ?? null,
        faviconUrl: input.site.faviconUrl ?? null,
      },
      tx,
    );
    return { workspaceId, siteId: site.id };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/setup-api.test.ts`
Expected: PASS

- [ ] **Step 5: Add `persistActiveContext`**

Append to `lib/auth/site.ts`:

```ts
export async function persistActiveContext(workspaceId: string, siteId: string): Promise<void> {
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
  jar.set("pc_ws", workspaceId, opts);
  jar.set("pc_site", siteId, opts);
}
```

- [ ] **Step 6: Add the route + endpoint**

```ts
// app/api/setup/route.ts
import { requireApiUser } from "@/lib/auth/auth";
import { runSetup } from "@/lib/setup/run-setup";
import { persistActiveContext } from "@/lib/auth/site";
import { created, badRequest } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const siteName = String(body?.site?.name ?? "").trim();
  if (!siteName) return badRequest("Site name required");
  const wsDraft = body?.workspace ?? null;
  if (wsDraft && !String(wsDraft?.name ?? "").trim()) return badRequest("Workspace name required");

  let result;
  try {
    result = await runSetup(u.user.id, {
      workspace: wsDraft ? { name: String(wsDraft.name), logoUrl: wsDraft.logoUrl ?? null } : null,
      site: {
        name: siteName,
        logoUrl: body?.site?.logoUrl ?? null,
        faviconUrl: body?.site?.faviconUrl ?? null,
      },
    });
  } catch {
    return badRequest("Could not complete setup");
  }
  await persistActiveContext(result.workspaceId, result.siteId);
  return created(result);
}
```

In `lib/api/endpoints.ts`, add a top-level key (after `site: "/api/site",`): `setup: "/api/setup",`

- [ ] **Step 7: Verify build + run the suite touched so far**

Run: `npx tsc --noEmit && npx vitest run tests/setup-api.test.ts tests/setup-gate.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/setup/run-setup.ts app/api/setup/route.ts lib/auth/site.ts lib/api/endpoints.ts tests/setup-api.test.ts
git commit -m "feat(setup): POST /api/setup creates workspace+site atomically and activates them"
```

### Task M1.7: Reusable step forms (`WorkspaceForm`, `SiteForm`, `DomainStep`)

**Files:**
- Create: `components/setup/types.ts`, `components/setup/WorkspaceForm.tsx`, `components/setup/SiteForm.tsx`, `components/setup/DomainStep.tsx`
- Test: `tests/setup-forms.dom.test.tsx` (create)

**Interfaces:**
- Produces:
  - `WorkspaceDraft = { name: string; logoUrl: string }`, `SiteDraft = { name: string; logoUrl: string; faviconUrl: string }` (in `components/setup/types.ts`)
  - `WorkspaceForm({ value: WorkspaceDraft; onChange: (v: WorkspaceDraft) => void })`
  - `SiteForm({ value: SiteDraft; onChange: (v: SiteDraft) => void })`
  - `DomainStep({ value: string; onChange: (hostname: string) => void })`

These are controlled, submit-less presentational forms (the parent owns submit), so they drop into both the full-screen wizard and the sidebar modals. They reuse the existing editor controls (`Field`, `TextInput`, `ImageInput`) which already handle uploads.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/setup-forms.dom.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceForm } from "@/components/setup/WorkspaceForm";

describe("WorkspaceForm", () => {
  it("emits name changes through onChange", () => {
    const onChange = vi.fn();
    render(<WorkspaceForm value={{ name: "", logoUrl: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Acme Inc."), { target: { value: "My Co" } });
    expect(onChange).toHaveBeenCalledWith({ name: "My Co", logoUrl: "" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/setup-forms.dom.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the types + forms**

```ts
// components/setup/types.ts
export type WorkspaceDraft = { name: string; logoUrl: string };
export type SiteDraft = { name: string; logoUrl: string; faviconUrl: string };
```

```tsx
// components/setup/WorkspaceForm.tsx
"use client";

import { Field, TextInput, ImageInput } from "@/components/editor/controls";
import type { WorkspaceDraft } from "./types";

export function WorkspaceForm({
  value,
  onChange,
}: {
  value: WorkspaceDraft;
  onChange: (v: WorkspaceDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Workspace name">
        <TextInput
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
          placeholder="Acme Inc."
        />
      </Field>
      <Field label="Workspace logo">
        <ImageInput value={value.logoUrl} onChange={(logoUrl) => onChange({ ...value, logoUrl })} />
      </Field>
    </div>
  );
}
```

```tsx
// components/setup/SiteForm.tsx
"use client";

import { Field, TextInput, ImageInput } from "@/components/editor/controls";
import type { SiteDraft } from "./types";

export function SiteForm({
  value,
  onChange,
}: {
  value: SiteDraft;
  onChange: (v: SiteDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Website name">
        <TextInput
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
          placeholder="Marketing site"
        />
      </Field>
      <Field label="Website image">
        <ImageInput value={value.logoUrl} onChange={(logoUrl) => onChange({ ...value, logoUrl })} />
      </Field>
      <Field label="Favicon">
        <ImageInput
          value={value.faviconUrl}
          onChange={(faviconUrl) => onChange({ ...value, faviconUrl })}
        />
      </Field>
    </div>
  );
}
```

```tsx
// components/setup/DomainStep.tsx
"use client";

import { Field, TextInput } from "@/components/editor/controls";

export function DomainStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (hostname: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Custom domain (optional)">
        <TextInput value={value} onChange={onChange} placeholder="www.example.com" />
      </Field>
      <p className="text-xs leading-relaxed text-zinc-500">
        Add it now or later from Site settings. We&rsquo;ll guide you through the DNS records after
        setup.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/setup-forms.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/setup/types.ts components/setup/WorkspaceForm.tsx components/setup/SiteForm.tsx components/setup/DomainStep.tsx tests/setup-forms.dom.test.tsx
git commit -m "feat(setup): reusable WorkspaceForm/SiteForm/DomainStep step forms"
```

### Task M1.8: Wizard orchestration helper + `SetupWizard` client + `/setup` route

**Files:**
- Create: `components/setup/wizard-steps.ts` (pure step logic), `components/setup/SetupWizard.tsx`
- Create: `app/setup/layout.tsx`, `app/setup/page.tsx`
- Test: `tests/wizard-steps.test.ts` (create)

**Interfaces:**
- Consumes: `WorkspaceForm`/`SiteForm`/`DomainStep` (M1.7), `endpoints.setup` + `endpoints.domains.list` (existing), `api` (axios).
- Produces: `wizardSteps(hasWorkspace: boolean) => ("workspace" | "site" | "domain")[]`; `SetupWizard({ userName, hasWorkspace })` client component.

- [ ] **Step 1: Write the failing test**

```ts
// tests/wizard-steps.test.ts
import { describe, it, expect } from "vitest";
import { wizardSteps } from "@/components/setup/wizard-steps";

describe("wizardSteps", () => {
  it("includes the workspace step for a brand-new user", () => {
    expect(wizardSteps(false)).toEqual(["workspace", "site", "domain"]);
  });
  it("skips the workspace step when one already exists", () => {
    expect(wizardSteps(true)).toEqual(["site", "domain"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/wizard-steps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the step logic**

```ts
// components/setup/wizard-steps.ts
export type WizardStep = "workspace" | "site" | "domain";

export function wizardSteps(hasWorkspace: boolean): WizardStep[] {
  return hasWorkspace ? ["site", "domain"] : ["workspace", "site", "domain"];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/wizard-steps.test.ts`
Expected: PASS

- [ ] **Step 5: Implement the wizard client**

```tsx
// components/setup/SetupWizard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/Button";
import { WorkspaceForm } from "./WorkspaceForm";
import { SiteForm } from "./SiteForm";
import { DomainStep } from "./DomainStep";
import { wizardSteps, type WizardStep } from "./wizard-steps";
import type { WorkspaceDraft, SiteDraft } from "./types";

export function SetupWizard({
  userName,
  hasWorkspace,
}: {
  userName: string;
  hasWorkspace: boolean;
}) {
  const router = useRouter();
  const steps = wizardSteps(hasWorkspace);
  const [i, setI] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceDraft>({
    name: userName ? `${userName}'s Workspace` : "",
    logoUrl: "",
  });
  const [site, setSite] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const step: WizardStep = steps[i];
  const canNext =
    step === "workspace" ? workspace.name.trim().length > 0 :
    step === "site" ? site.name.trim().length > 0 :
    true;

  async function finish() {
    setBusy(true);
    setErr("");
    try {
      await api.post(endpoints.setup, {
        workspace: hasWorkspace ? null : workspace,
        site,
      });
      const host = domain.trim();
      if (host) await api.post(endpoints.domains.list, { hostname: host }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch {
      setBusy(false);
      setErr("Something went wrong. Please try again.");
    }
  }

  function next() {
    if (i < steps.length - 1) setI(i + 1);
    else void finish();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-500">
        Step {i + 1} of {steps.length}
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">
        {step === "workspace" && "Create your workspace"}
        {step === "site" && "Create your website"}
        {step === "domain" && "Connect a domain"}
      </h1>

      {step === "workspace" && <WorkspaceForm value={workspace} onChange={setWorkspace} />}
      {step === "site" && <SiteForm value={site} onChange={setSite} />}
      {step === "domain" && <DomainStep value={domain} onChange={setDomain} />}

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" isDisabled={i === 0 || busy} onPress={() => setI(i - 1)}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {step === "domain" && (
            <Button variant="ghost" isDisabled={busy} onPress={() => void finish()}>
              Skip for now
            </Button>
          )}
          <Button isDisabled={!canNext || busy} onPress={next}>
            {i === steps.length - 1 ? (busy ? "Creating…" : "Finish") : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

(If `Button` does not accept `isDisabled`/`onPress`, match the existing prop names used in `components/app-shell/Sidebar.tsx`, which already uses `onPress`. Verify against `components/ui/Button` before running.)

- [ ] **Step 6: Implement the `/setup` route + full-screen layout**

```tsx
// app/setup/layout.tsx
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
```

```tsx
// app/setup/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/auth";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { needsSetup } from "@/lib/auth/setup-gate";
import { SetupWizard } from "@/components/setup/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await requireUser();
  const ctx = await getActiveWorkspace();
  const siteCount = ctx
    ? await prisma.site.count({ where: { workspaceId: ctx.workspace.id } })
    : 0;
  if (!needsSetup({ hasWorkspace: !!ctx, siteCount })) redirect("/");
  return <SetupWizard userName={user.name} hasWorkspace={!!ctx} />;
}
```

- [ ] **Step 7: Verify build + run the wizard test**

Run: `npx tsc --noEmit && npx vitest run tests/wizard-steps.test.ts`
Expected: PASS

- [ ] **Step 8: Manual smoke (optional, requires dev server already running)**

Sign up a new account → after onboarding you should be redirected to `/setup` → completing it lands on `/` with the new workspace + site active. (Do not start `next build`; use the running `next dev`.)

- [ ] **Step 9: Commit**

```bash
git add components/setup/wizard-steps.ts components/setup/SetupWizard.tsx app/setup tests/wizard-steps.test.ts
git commit -m "feat(setup): /setup wizard prompts new users to create a workspace + site"
```

### Task M1.9: Favicon on the published site

**Files:**
- Create: `lib/seo/favicon.ts`
- Modify: `app/p/[slug]/page.tsx` (`generateMetadata`)
- Test: `tests/favicon-metadata.test.ts` (create)

**Interfaces:**
- Produces: `faviconMetadata(faviconUrl: string | null | undefined) => { icons?: { icon: string } }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/favicon-metadata.test.ts
import { describe, it, expect } from "vitest";
import { faviconMetadata } from "@/lib/seo/favicon";

describe("faviconMetadata", () => {
  it("returns an icons block when a favicon is set", () => {
    expect(faviconMetadata("/f.ico")).toEqual({ icons: { icon: "/f.ico" } });
  });
  it("returns an empty object when missing", () => {
    expect(faviconMetadata(null)).toEqual({});
    expect(faviconMetadata(undefined)).toEqual({});
    expect(faviconMetadata("")).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/favicon-metadata.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// lib/seo/favicon.ts
import type { Metadata } from "next";

export function faviconMetadata(faviconUrl: string | null | undefined): Pick<Metadata, "icons"> {
  return faviconUrl ? { icons: { icon: faviconUrl } } : {};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/favicon-metadata.test.ts`
Expected: PASS

- [ ] **Step 5: Wire it into `generateMetadata`**

In `app/p/[slug]/page.tsx`, import the helper and the resolver, and spread the favicon into the returned metadata. Replace the body of `generateMetadata` (lines 25-36) with:

```ts
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page || !page.published) return { title: "Page not found" };
  const site = await prisma.site.findUnique({
    where: { id: page.siteId },
    select: { faviconUrl: true },
  });
  const title = page.metaTitle || page.title;
  const description = page.metaDescription || undefined;
  const images = page.ogImage ? [page.ogImage] : undefined;
  return {
    title,
    description,
    ...faviconMetadata(site?.faviconUrl),
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
```

Add `import { faviconMetadata } from "@/lib/seo/favicon";` at the top.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/seo/favicon.ts app/p/\[slug\]/page.tsx tests/favicon-metadata.test.ts
git commit -m "feat(seo): render the site favicon on published pages"
```

### Task M1.10: Milestone 1 gate

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run format:check`
Expected: all PASS. If a previously-passing integration test assumed signup creates a workspace/site, update it to create its own fixtures (the new model never auto-creates).

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "test: stabilize suite after setup-flow changes"
```

---

## Milestone 2 — Sidebar site switcher & reusable creation modals

Adds the stacked `SiteSwitcher` under the workspace switcher, a "New site" modal (reusing `SiteForm`), and routes "New workspace" through the full wizard via `POST /api/setup`.

### Task M2.1: `SiteSwitcher` helpers (pure)

**Files:**
- Create: `components/app-shell/SiteSwitcher.helpers.ts`
- Test: `tests/site-switcher-helpers.test.ts` (create)

**Interfaces:**
- Produces: `type SiteOption = { id: string; name: string; handle: string }`; `siteInitial(name?: string) => string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/site-switcher-helpers.test.ts
import { describe, it, expect } from "vitest";
import { siteInitial } from "@/components/app-shell/SiteSwitcher.helpers";

describe("siteInitial", () => {
  it("uppercases the first character", () => {
    expect(siteInitial("marketing")).toBe("M");
  });
  it("falls back to S for empty names", () => {
    expect(siteInitial("")).toBe("S");
    expect(siteInitial(undefined)).toBe("S");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/site-switcher-helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// components/app-shell/SiteSwitcher.helpers.ts
export type SiteOption = { id: string; name: string; handle: string };

export function siteInitial(name?: string): string {
  const t = (name ?? "").trim();
  return t ? t.charAt(0).toUpperCase() : "S";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/site-switcher-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/app-shell/SiteSwitcher.helpers.ts tests/site-switcher-helpers.test.ts
git commit -m "feat(sidebar): SiteSwitcher pure helpers"
```

### Task M2.2: `SiteSwitcher` component (switch + new-site modal)

**Files:**
- Create: `components/app-shell/SiteSwitcher.tsx`
- Test: `tests/site-switcher.dom.test.tsx` (create)

**Interfaces:**
- Consumes: `SiteOption`/`siteInitial` (M2.1), `SiteForm` (M1.7), `endpoints.sites.switch` + `endpoints.sites.list` (existing), `api`.
- Produces: `SiteSwitcher({ collapsed, sites, activeSiteId })`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/site-switcher.dom.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteSwitcher } from "@/components/app-shell/SiteSwitcher";

describe("SiteSwitcher", () => {
  it("shows the active site name", () => {
    render(
      <SiteSwitcher
        collapsed={false}
        sites={[
          { id: "a", name: "Marketing Site", handle: "marketing" },
          { id: "b", name: "Blog", handle: "blog" },
        ]}
        activeSiteId="a"
      />,
    );
    expect(screen.getByText("Marketing Site")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/site-switcher.dom.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```tsx
// components/app-shell/SiteSwitcher.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SiteForm } from "@/components/setup/SiteForm";
import type { SiteDraft } from "@/components/setup/types";
import { siteInitial, type SiteOption } from "./SiteSwitcher.helpers";

export function SiteSwitcher({
  collapsed,
  sites,
  activeSiteId,
}: {
  collapsed: boolean;
  sites: SiteOption[];
  activeSiteId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const active = sites.find((s) => s.id === activeSiteId) ?? sites[0];

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await api.post(endpoints.sites.switch, { id }).catch(() => {});
    router.refresh();
    setBusy(false);
    setOpen(false);
  }

  async function createSite() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(endpoints.sites.list, draft);
      if (data?.id) await api.post(endpoints.sites.switch, { id: data.id });
      setCreating(false);
      setDraft({ name: "", logoUrl: "", faviconUrl: "" });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
          {siteInitial(active?.name)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full px-2 pb-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-[#e8eaed] bg-white px-2.5 py-2 text-left hover:border-[#d6dae0]"
      >
        <Globe size={15} className="shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#111827]">
          {active?.name ?? "No site"}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-[#9aa1ac]" />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aeb4bd]">
            Sites
          </p>
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => switchTo(s.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
              {s.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-[#f1f3f5]" />
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Plus size={15} /> New site
          </button>
        </div>
      )}

      <Modal isOpen={creating} onOpenChange={setCreating} title="Create a new site">
        <div className="space-y-4 p-1">
          <SiteForm value={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" isDisabled={busy} onPress={() => setCreating(false)}>
              Cancel
            </Button>
            <Button isDisabled={busy || !draft.name.trim()} onPress={() => void createSite()}>
              {busy ? "Creating…" : "Create site"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

(Before running, confirm the exact `Modal` import/prop names in `components/ui/` — mirror how `CollectionManager` opens its modal. Adjust `isOpen`/`onOpenChange`/`title` to match the primitive.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/site-switcher.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/app-shell/SiteSwitcher.tsx tests/site-switcher.dom.test.tsx
git commit -m "feat(sidebar): SiteSwitcher with switch + new-site modal"
```

### Task M2.3: Thread sites into the sidebar

**Files:**
- Modify: `app/(app)/layout.tsx` (fetch sites + active site id, pass to `Sidebar`)
- Modify: `components/app-shell/Sidebar.tsx` (accept + forward `sites`, `activeSiteId`)
- Modify: `components/app-shell/Sidebar.helpers.tsx:45` (render `SiteSwitcher` under `WorkspaceSwitcher`)

**Interfaces:**
- Consumes: `SiteSwitcher` (M2.2), `getActiveSite` (existing).

- [ ] **Step 1: Fetch sites in the layout**

In `app/(app)/layout.tsx`, after the `needsSetup`/`if (!ctx)` gate, add:

```ts
  const sites = await prisma.site.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, handle: true },
  });
  const activeSiteId = (await getActiveSite())?.site.id;
```

Add `import { getActiveSite } from "@/lib/auth/site";` and pass two new props to `<Sidebar … sites={sites} activeSiteId={activeSiteId} />`.

- [ ] **Step 2: Forward through `Sidebar`**

In `components/app-shell/Sidebar.tsx`, extend the props type with `sites: { id: string; name: string; handle: string }[]` and `activeSiteId?: string`, and pass them into `<SidebarRail … sites={sites} activeSiteId={activeSiteId} />` (the `rail` element, line ~57).

- [ ] **Step 3: Render the switcher in the rail**

In `components/app-shell/Sidebar.helpers.tsx`: extend `SidebarRail`'s props with `sites` + `activeSiteId`, import `SiteSwitcher`, and render it directly under the `WorkspaceSwitcher` (after line 45):

```tsx
        <WorkspaceSwitcher collapsed={collapsed} workspaces={workspaces} activeId={active?.id} />
        <SiteSwitcher collapsed={collapsed} sites={sites} activeSiteId={activeSiteId} />
```

- [ ] **Step 4: Verify build + the existing sidebar tests**

Run: `npx tsc --noEmit && npx vitest run tests/workspace-trigger.dom.test.tsx tests/site-switcher.dom.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/layout.tsx components/app-shell/Sidebar.tsx components/app-shell/Sidebar.helpers.tsx
git commit -m "feat(sidebar): stack the SiteSwitcher under the workspace switcher"
```

### Task M2.4: Route "New workspace" through the full wizard

**Files:**
- Modify: `components/app-shell/WorkspaceSwitcher.tsx` (replace inline create with a wizard modal)
- Create: `components/setup/CreateWorkspaceModal.tsx` (workspace + first site via `POST /api/setup`)
- Test: `tests/create-workspace-modal.dom.test.tsx` (create)

**Interfaces:**
- Consumes: `WorkspaceForm` + `SiteForm` (M1.7), `endpoints.setup`, `endpoints.workspaces.switch`, `api`.
- Produces: `CreateWorkspaceModal({ open, onClose })`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/create-workspace-modal.dom.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateWorkspaceModal } from "@/components/setup/CreateWorkspaceModal";

describe("CreateWorkspaceModal", () => {
  it("renders both the workspace and site fields", () => {
    render(<CreateWorkspaceModal open onClose={() => {}} />);
    expect(screen.getByPlaceholderText("Acme Inc.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Marketing site")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/create-workspace-modal.dom.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the modal**

```tsx
// components/setup/CreateWorkspaceModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WorkspaceForm } from "./WorkspaceForm";
import { SiteForm } from "./SiteForm";
import type { WorkspaceDraft, SiteDraft } from "./types";

export function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDraft>({ name: "", logoUrl: "" });
  const [site, setSite] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!workspace.name.trim() || !site.name.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(endpoints.setup, { workspace, site });
      if (data?.workspaceId)
        await api.post(endpoints.workspaces.switch, { id: data.workspaceId }).catch(() => {});
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()} title="Create a new workspace">
      <div className="space-y-5 p-1">
        <WorkspaceForm value={workspace} onChange={setWorkspace} />
        <div className="border-t border-zinc-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            First website
          </p>
          <SiteForm value={site} onChange={setSite} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" isDisabled={busy} onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={busy || !workspace.name.trim() || !site.name.trim()}
            onPress={() => void create()}
          >
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Swap the inline create for the modal**

In `components/app-shell/WorkspaceSwitcher.tsx`: remove the inline `creating`/`name`/`err`/`create()` state and the `CreateWorkspaceForm` branch; instead render `<CreateWorkspaceModal open={creating} onClose={() => setCreating(false)} />` and keep the "New workspace" button setting `setCreating(true)`. Drop now-unused imports (`CreateWorkspaceForm`, `createWorkspaceError`) flagged by lint.

- [ ] **Step 5: Run to verify it passes + build**

Run: `npx vitest run tests/create-workspace-modal.dom.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/setup/CreateWorkspaceModal.tsx components/app-shell/WorkspaceSwitcher.tsx tests/create-workspace-modal.dom.test.tsx
git commit -m "feat(sidebar): New workspace opens the full workspace+site wizard"
```

### Task M2.5: Milestone 2 gate

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run format:check`
Expected: all PASS.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "test: stabilize suite after sidebar switcher"
```

---

## Milestone 3 — Editor page-settings panel

Reworks the editor's SEO tab into a "Page" panel: slug (validated), SEO/social, status + homepage, and site shortcuts.

### Task M3.1: Editor store — `setSlug` + `setNoindex` + `noindex` state

**Files:**
- Modify: `store/editor-store.ts` (state field + action signatures + init param)
- Modify: `store/editor-store.actions.ts` (`createMetaActions`, `init`)
- Test: `tests/editor-meta-actions.test.ts` (create)

**Interfaces:**
- Produces: store `noindex: boolean`; actions `setSlug(slug: string)`, `setNoindex(noindex: boolean)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/editor-meta-actions.test.ts
import { describe, it, expect } from "vitest";
import { createMetaActions } from "@/store/editor-store.actions";

describe("createMetaActions", () => {
  it("setSlug and setNoindex set state and mark dirty", () => {
    const calls: Array<Record<string, unknown>> = [];
    const set = ((patch: Record<string, unknown>) => calls.push(patch)) as never;
    const actions = createMetaActions(set);
    actions.setSlug("about-us");
    actions.setNoindex(true);
    expect(calls[0]).toEqual({ slug: "about-us", dirty: true });
    expect(calls[1]).toEqual({ noindex: true, dirty: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/editor-meta-actions.test.ts`
Expected: FAIL — `setSlug`/`setNoindex` not in the returned actions.

- [ ] **Step 3: Extend the store types**

In `store/editor-store.ts`:
- Add to `EditorState` (page meta block, after `slug: string;`): `noindex: boolean;`
- Add to the `init` param object type (after `slug: string;`): `noindex?: boolean;`
- Add to the actions section (after `setPublished`): `setSlug: (slug: string) => void;` and `setNoindex: (noindex: boolean) => void;`
- Add to the initial state object (after `slug: "",`): `noindex: false,`

- [ ] **Step 4: Implement the actions + init**

In `store/editor-store.actions.ts`:
- In `createLifecycleActions` `init`, add `noindex: page.noindex ?? false,` to the `set({...})` object.
- Replace `MetaActions` type + `createMetaActions`:

```ts
type MetaActions = Pick<EditorState, "setTitle" | "setPublished" | "setSlug" | "setNoindex">;

export const createMetaActions = (set: Set): MetaActions => ({
  setTitle: (title) => set({ title, dirty: true }),
  setPublished: (published) => set({ published }),
  setSlug: (slug) => set({ slug, dirty: true }),
  setNoindex: (noindex) => set({ noindex, dirty: true }),
});
```

- [ ] **Step 5: Run to verify it passes + build**

Run: `npx vitest run tests/editor-meta-actions.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add store/editor-store.ts store/editor-store.actions.ts tests/editor-meta-actions.test.ts
git commit -m "feat(editor): store actions for slug + noindex"
```

### Task M3.2: Slug normalize helper + validated page PATCH (+ set-home + noindex)

**Files:**
- Create: `lib/pages/slug.ts`
- Modify: `app/api/pages/[id]/route.ts` (`PUT` — accept `slug` validated unique + `noindex`)
- Create: `app/api/pages/[id]/home/route.ts` (POST — set this page as the site home)
- Modify: `lib/api/endpoints.ts` (`pages.setHome`)
- Test: `tests/page-slug.test.ts` (create), `tests/page-slug-api.test.ts` (create)

**Interfaces:**
- Produces: `pageSlugFrom(input: string) => string`; `PUT /api/pages/:id` accepts `{ slug?, noindex? }` (slug 400s on collision within the site); `POST /api/pages/:id/home`; `endpoints.pages.setHome(id)`.

- [ ] **Step 1: Write the failing unit test**

```ts
// tests/page-slug.test.ts
import { describe, it, expect } from "vitest";
import { pageSlugFrom } from "@/lib/pages/slug";

describe("pageSlugFrom", () => {
  it("kebab-cases and strips leading slashes", () => {
    expect(pageSlugFrom("/About Us/")).toBe("about-us");
    expect(pageSlugFrom("Pricing & Plans")).toBe("pricing-plans");
  });
  it("returns empty string for blank input", () => {
    expect(pageSlugFrom("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/page-slug.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// lib/pages/slug.ts
import { slugify } from "@/lib/utils";

export function pageSlugFrom(input: string): string {
  const trimmed = (input ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  return slugify(trimmed);
}
```

(Confirm `slugify` lowercases + hyphenates; the unit test asserts the exact expected output. If `slugify` has a non-empty fallback, guard the empty case before calling it — the test for `"   "` must yield `""`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/page-slug.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing API integration test**

```ts
// tests/page-slug-api.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyPageSlug } from "@/lib/pages/apply-slug";

const prisma = new PrismaClient();
const wss: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wss } } });
  await prisma.$disconnect();
});

describe("applyPageSlug", () => {
  it("rejects a slug already used by another page in the same site", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `slug-${Date.now()}` } });
    wss.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    await prisma.page.create({ data: { title: "A", slug: "about", siteId: site.id } });
    const target = await prisma.page.create({ data: { title: "B", slug: "b", siteId: site.id } });

    await expect(applyPageSlug(prisma, site.id, target.id, "About")).rejects.toThrow("slug_taken");

    const ok = await applyPageSlug(prisma, site.id, target.id, "Contact");
    expect(ok).toBe("contact");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/page-slug-api.test.ts`
Expected: FAIL — `@/lib/pages/apply-slug` not found.

- [ ] **Step 7: Implement the validated slug applier**

```ts
// lib/pages/apply-slug.ts
import type { PrismaClient } from "@prisma/client";
import { pageSlugFrom } from "./slug";

export async function applyPageSlug(
  db: PrismaClient,
  siteId: string,
  pageId: string,
  input: string,
): Promise<string> {
  const slug = pageSlugFrom(input);
  if (!slug) throw new Error("slug_empty");
  const clash = await db.page.findFirst({ where: { siteId, slug, NOT: { id: pageId } } });
  if (clash) throw new Error("slug_taken");
  await db.page.update({ where: { id: pageId }, data: { slug } });
  return slug;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run tests/page-slug-api.test.ts`
Expected: PASS

- [ ] **Step 9: Wire slug + noindex into the page PUT**

In `app/api/pages/[id]/route.ts` `PUT`, extend the typed `data` object with `slug?: string` and `noindex?: boolean`, and before the `updateMany` add:

```ts
      if (typeof body.noindex === "boolean") data.noindex = body.noindex;
      if (typeof body.slug === "string") {
        const { pageSlugFrom } = await import("@/lib/pages/slug");
        const slug = pageSlugFrom(body.slug);
        if (!slug) return badRequest("Slug cannot be empty");
        const clash = await prisma.page.findFirst({
          where: { siteId: ctx.site.id, slug, NOT: { id } },
        });
        if (clash) return badRequest("That slug is already used by another page");
        data.slug = slug;
      }
```

Add `badRequest` to the imports from `@/lib/api/api-response`.

- [ ] **Step 10: Add the set-home route + endpoint**

```ts
// app/api/pages/[id]/home/route.ts
import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("EDITOR", async (ctx) => {
    const page = await prisma.page.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!page) return notFound();
    await prisma.site.update({ where: { id: ctx.site.id }, data: { homePageId: id } });
    return json({ ok: true });
  });
}
```

In `lib/api/endpoints.ts`, add to the `pages` block: `setHome: (id: string) => \`/api/pages/${id}/home\`,`

- [ ] **Step 11: Verify build + the slug tests**

Run: `npx tsc --noEmit && npx vitest run tests/page-slug.test.ts tests/page-slug-api.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add lib/pages/slug.ts lib/pages/apply-slug.ts app/api/pages/\[id\]/route.ts app/api/pages/\[id\]/home/route.ts lib/api/endpoints.ts tests/page-slug.test.ts tests/page-slug-api.test.ts
git commit -m "feat(pages): validated slug PATCH, noindex, and set-as-home endpoint"
```

### Task M3.3: Extend `/api/site` (active site) with name/logo/favicon

**Files:**
- Modify: `app/api/site/route.ts` (GET returns branding; PUT accepts `name`, `logoUrl`, `faviconUrl`)
- Test: `tests/site-branding-api.test.ts` (create)

**Interfaces:**
- Produces: `GET /api/site` includes `{ name, logoUrl, faviconUrl }`; `PUT /api/site` accepts those fields.

- [ ] **Step 1: Write the failing test (pure shaping helper)**

Extract the branding read so it is unit-testable:

```ts
// tests/site-branding-api.test.ts
import { describe, it, expect } from "vitest";
import { siteBrandingJson } from "@/lib/sites/branding";

describe("siteBrandingJson", () => {
  it("exposes name + logo + favicon", () => {
    expect(siteBrandingJson({ name: "S", logoUrl: "/l", faviconUrl: "/f" })).toEqual({
      name: "S",
      logoUrl: "/l",
      faviconUrl: "/f",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/site-branding-api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// lib/sites/branding.ts
export function siteBrandingJson(s: {
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}): { name: string; logoUrl: string | null; faviconUrl: string | null } {
  return { name: s.name, logoUrl: s.logoUrl, faviconUrl: s.faviconUrl };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/site-branding-api.test.ts`
Expected: PASS

- [ ] **Step 5: Wire branding into `/api/site`**

In `app/api/site/route.ts`:
- Import the helper: `import { siteBrandingJson } from "@/lib/sites/branding";`
- In `siteJson(...)`, change the param type to also include `name`, `logoUrl`, `faviconUrl`, and spread branding into the returned object: `return { ...siteBrandingJson(site), header: ..., footer: ..., colors: ..., textStyles: ... };`
- In `PUT`, extend the typed `data` object and add:

```ts
    if (typeof body.name === "string") data.name = body.name.slice(0, 80);
    if (typeof body.logoUrl === "string") data.logoUrl = body.logoUrl || null;
    if (typeof body.faviconUrl === "string") data.faviconUrl = body.faviconUrl || null;
```

(Type `data` as `{ header?: string; footer?: string; colors?: string; textStyles?: string; name?: string; logoUrl?: string | null; faviconUrl?: string | null }`.)

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npx vitest run tests/site-branding-api.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/site/route.ts lib/sites/branding.ts tests/site-branding-api.test.ts
git commit -m "feat(site): active-site API exposes + updates name/logo/favicon"
```

### Task M3.4: `PagePanel` + rework the editor rail

**Files:**
- Create: `components/editor/PagePanel.tsx`
- Modify: `components/editor/LeftPanel.tsx` (rail entry `seo` → `page`, render `PagePanel`)
- Test: `tests/page-panel.dom.test.tsx` (create)

**Interfaces:**
- Consumes: `useEditor` store (`slug`, `setSlug`, `noindex`, `setNoindex`, `published`, `pageId`), `SeoPanel` (existing), `endpoints.pages.byId/setHome`, `endpoints.site`, `api`, editor `controls`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/page-panel.dom.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEditor } from "@/store/editor-store";
import { PagePanel } from "@/components/editor/PagePanel";

describe("PagePanel", () => {
  beforeEach(() => {
    useEditor.getState().init({
      id: "p1",
      title: "About",
      slug: "about",
      published: false,
      noindex: false,
      tree: [],
    });
  });
  it("shows the current slug", () => {
    render(<PagePanel />);
    expect((screen.getByDisplayValue("about") as HTMLInputElement).value).toBe("about");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/page-panel.dom.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `PagePanel`**

```tsx
// components/editor/PagePanel.tsx
"use client";

import { useState } from "react";
import { useEditor } from "@/store/editor-store";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Field, TextInput, Toggle } from "./controls";
import { SeoPanel } from "./SeoPanel";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-200 p-3">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function PagePanel() {
  const pageId = useEditor((s) => s.pageId);
  const slug = useEditor((s) => s.slug);
  const setSlug = useEditor((s) => s.setSlug);
  const published = useEditor((s) => s.published);
  const noindex = useEditor((s) => s.noindex);
  const setNoindex = useEditor((s) => s.setNoindex);
  const [slugErr, setSlugErr] = useState("");
  const [savedHome, setSavedHome] = useState(false);

  async function commitSlug() {
    if (!pageId) return;
    setSlugErr("");
    try {
      await api.put(endpoints.pages.byId(pageId), { slug });
    } catch {
      setSlugErr("That slug is taken or invalid.");
    }
  }

  async function commitNoindex(v: boolean) {
    setNoindex(v);
    if (pageId) await api.put(endpoints.pages.byId(pageId), { noindex: v }).catch(() => {});
  }

  async function setAsHome() {
    if (!pageId) return;
    await api.post(endpoints.pages.setHome(pageId), {}).catch(() => {});
    setSavedHome(true);
  }

  return (
    <div>
      <Section title="Page address">
        <Field label="Slug">
          <TextInput value={slug} onChange={setSlug} onBlur={commitSlug} placeholder="about-us" />
        </Field>
        {slugErr ? (
          <p className="mt-1 text-xs text-red-600">{slugErr}</p>
        ) : (
          published && (
            <p className="mt-1 text-[11px] text-amber-600">
              This page is live — changing the slug changes its public URL.
            </p>
          )
        )}
      </Section>

      <Section title="Status">
        <button
          onClick={() => void setAsHome()}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300"
        >
          {savedHome ? "Set as homepage ✓" : "Set as homepage"}
        </button>
      </Section>

      <Section title="Search">
        <label className="flex items-center justify-between">
          <span className="text-sm text-zinc-700">Hide from search engines</span>
          <Toggle value={noindex} onChange={(v) => void commitNoindex(v)} />
        </label>
      </Section>

      <SeoPanel />
    </div>
  );
}
```

(If `TextInput` does not support an `onBlur` prop, commit the slug on the existing change path instead — verify the `TextInput` signature in `components/editor/controls.tsx:54` and adapt. The published/draft toggle already lives in the editor `TopBar`; this panel intentionally does not duplicate it.)

- [ ] **Step 4: Rework the rail**

In `components/editor/LeftPanel.tsx`:
- Change the `Section` union: replace `"seo"` with `"page"`.
- In `RAIL`, change the `seo` entry to `{ id: "page", label: "Page", icon: Globe }` (keep `Globe` or swap to a `FileCog` import).
- In `TITLES`, replace the `seo` key with `page: "Page settings"`.
- In the render switch, replace `{section === "seo" && <SeoPanel />}` with `{section === "page" && <PagePanel />}`.
- Replace the `SeoPanel` import with `import { PagePanel } from "./PagePanel";` (PagePanel imports SeoPanel itself).

- [ ] **Step 5: Run to verify it passes + build**

Run: `npx vitest run tests/page-panel.dom.test.tsx && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/editor/PagePanel.tsx components/editor/LeftPanel.tsx tests/page-panel.dom.test.tsx
git commit -m "feat(editor): Page settings panel (slug, status, search, SEO)"
```

### Task M3.5: Site shortcuts in the Page panel

**Files:**
- Modify: `components/editor/PagePanel.tsx` (add a "Website" section: name + favicon via `/api/site`, domain link)
- Test: extend `tests/page-panel.dom.test.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/site` (M3.3), `endpoints.site`, `ImageInput`.

- [ ] **Step 1: Add the failing assertion**

Append to `tests/page-panel.dom.test.tsx`:

```tsx
  it("renders a Website section heading", () => {
    render(<PagePanel />);
    expect(screen.getByText("Website")).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/page-panel.dom.test.tsx`
Expected: FAIL — no "Website" text yet.

- [ ] **Step 3: Add the site-shortcuts section**

In `components/editor/PagePanel.tsx`, add a `useEffect` to load the active site branding once and a "Website" `Section`. Add imports `useEffect` and `ImageInput`:

```tsx
  const [siteName, setSiteName] = useState("");
  const [favicon, setFavicon] = useState("");

  useEffect(() => {
    let alive = true;
    void api
      .get(endpoints.site)
      .then(({ data }) => {
        if (!alive) return;
        setSiteName(data?.name ?? "");
        setFavicon(data?.faviconUrl ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function saveSite(patch: { name?: string; faviconUrl?: string }) {
    await api.put(endpoints.site, patch).catch(() => {});
  }
```

Render before the closing `</div>`:

```tsx
      <Section title="Website">
        <Field label="Site name">
          <TextInput
            value={siteName}
            onChange={setSiteName}
            onBlur={() => void saveSite({ name: siteName })}
            placeholder="My website"
          />
        </Field>
        <Field label="Favicon">
          <ImageInput
            value={favicon}
            onChange={(v) => {
              setFavicon(v);
              void saveSite({ faviconUrl: v });
            }}
          />
        </Field>
        <a
          href="/site-settings"
          className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline"
        >
          Manage domains →
        </a>
      </Section>
```

- [ ] **Step 4: Run to verify it passes + build + lint**

Run: `npx vitest run tests/page-panel.dom.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/editor/PagePanel.tsx tests/page-panel.dom.test.tsx
git commit -m "feat(editor): site shortcuts (name, favicon, domains link) in Page panel"
```

### Task M3.6: Milestone 3 gate

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run format:check`
Expected: all PASS.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "test: stabilize suite after editor Page panel"
```

---

## Notes for the implementer

- **Verify primitive prop names before running UI tasks.** `components/ui/Button` and `components/ui/Modal` prop names (`onPress`/`isDisabled`/`isOpen`/`onOpenChange`) are assumed from existing usage (`Sidebar.tsx` uses `onPress`). If `Modal` differs, mirror exactly how `CollectionManager` opens its dialog, and use `dialog-provider` (`useConfirm`/`useAlert`) for confirmations.
- **`slugify` behaviour** (`lib/utils`) backs both workspace handles and page slugs; the `pageSlugFrom` unit test pins the exact expected output — adapt the guard if `slugify` injects a non-empty fallback.
- **Don't run `next build`** at any point; the dev server shares `.next/`. The per-task gate is `tsc` + `vitest` + `lint` + `format:check`.
- **Integration tests hit the dev Postgres** (port 5433). If they fail to connect, confirm `brew services` has `postgresql@16` running and `.env` `DATABASE_URL` targets the `pagistry` db.
- **Deferred:** post-setup logo/favicon editing is delivered through the wizard (M1) and the editor Page panel's Website section (M3.5, via `PUT /api/site`). Adding the same logo/favicon fields to the `/site-settings` General tab (and extending `PATCH /api/sites/[id]` to accept them) is a small follow-up, intentionally out of this plan since the editor already covers "edit it later."
