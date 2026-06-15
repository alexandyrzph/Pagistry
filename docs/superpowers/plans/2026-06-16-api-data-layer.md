# API & Data Layer Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove copy-paste boilerplate from the ~30 API route handlers (auth/scoping guard, JSON parsing, error responses) and add request validation, so adding/maintaining a route is consistent and forgetting tenancy scoping becomes structurally hard.

**Architecture:** Introduce four small `lib/` modules — web-standard response helpers (`api-response.ts`), JSON parse helpers (`json-parse.ts`), guard-callback helpers (`api-handler.ts`), and zod request schemas (`schemas.ts`) — then migrate routes onto them. Routes keep Next 16's native `export async function GET/POST/...` signatures; the guard helpers take a callback rather than wrapping the export, so we never fight Next's route type validator.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` instead of `middleware.ts`), Prisma 6 + SQLite, zod (new dependency), Vitest 4 (node env), TypeScript 5.

> ⚠️ **Per `AGENTS.md`:** this is a modified Next.js 16. The conventions this plan relies on are already proven in the existing route files (`params: Promise<...>`, plain `Response` returns, `export const dynamic = "force-dynamic"`). Do **not** convert handlers to `export const GET = wrapper(...)` HOF form — keep named `async function` exports. If anything here conflicts with `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, the docs win; stop and flag it.

> **Verification reality:** there is currently **no route-handler/Prisma test harness** (existing tests only cover pure functions and the in-memory zustand store). So the four new `lib/` modules are built with full TDD (they are pure and need no DB). The route migrations are **behavior-preserving refactors** verified by `npx tsc --noEmit`, `npm run build`, the existing `npm test` staying green, and a targeted manual `curl` smoke check — not new integration tests. This is called out again in the relevant tasks.

> **Every commit** must end with the trailer:
> `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
> The examples below show it on the first commit; include it on all of them.

> **Branch first** if you are on the default branch (the global rule). Suggested: `git switch -c refactor/api-data-layer`.

---

## File Structure

| File | Responsibility | Created in |
|------|----------------|------------|
| `lib/json-parse.ts` | `parseJsonArray` / `parseJsonObject` — replace 4 inline `safeParse` copies | Task 1 |
| `lib/api-response.ts` | `json` / `created` / `error` / `badRequest` / `unauthorized` / `forbidden` / `notFound` — one response envelope | Task 2 |
| `lib/api-handler.ts` | `runGuarded` (pure core) + `withWorkspace` / `withRole` — run a handler only after the tenancy guard passes | Task 3 |
| `lib/schemas.ts` | zod request schemas + `parseBody` helper | Task 4 |
| `tests/json-parse.test.ts`, `tests/api-response.test.ts`, `tests/api-handler.test.ts`, `tests/schemas.test.ts` | unit tests for the above | Tasks 1–4 |
| `app/api/**/route.ts` (~30 files) | migrate onto the new helpers | Tasks 5–7 |

Design notes that lock in the decomposition:
- `api-response.ts` returns the **web-standard `Response`** (not `NextResponse`), exactly like the existing `res()` in `lib/workspace.ts:43-45`. This keeps the helpers importable in the Vitest node env with no Next runtime, and `JSON.stringify` serializes `Date` fields to ISO strings identically to `NextResponse.json` — so it is a drop-in for the current routes.
- `api-handler.ts` splits the **pure** decision (`runGuarded`) from the **impure** adapters (`withWorkspace`/`withRole`, which call the cookie/DB-touching guards). Only the pure core is unit-tested; the adapters are three lines each.

---

## Task 1: `lib/json-parse.ts` — shared JSON parse helpers

There are 4 near-identical `safeParse`/`safe` copies today:
`app/api/components/route.ts:7-14`, `app/api/components/[id]/route.ts:9-14`, `app/api/submissions/route.ts:52-58` (returns object), `app/api/activity/route.ts:37-43` (returns object).

**Files:**
- Create: `lib/json-parse.ts`
- Test: `tests/json-parse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/json-parse.test.ts
import { describe, it, expect } from "vitest";
import { parseJsonArray, parseJsonObject } from "@/lib/json-parse";

describe("parseJsonArray", () => {
  it("returns the array for a valid JSON array", () => {
    expect(parseJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("returns [] for a JSON object", () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
  it("returns [] for invalid JSON", () => {
    expect(parseJsonArray("not json")).toEqual([]);
  });
});

describe("parseJsonObject", () => {
  it("returns the object for a valid JSON object", () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns {} for a JSON array", () => {
    expect(parseJsonObject("[1,2]")).toEqual({});
  });
  it("returns {} for invalid JSON", () => {
    expect(parseJsonObject("nope")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/json-parse.test.ts`
Expected: FAIL — cannot find module `@/lib/json-parse`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/json-parse.ts

/** Parse a JSON string expected to hold an array. Returns [] on any failure or non-array. */
export function parseJsonArray<T = unknown>(s: string): T[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Parse a JSON string expected to hold a plain object. Returns {} on any failure or non-object. */
export function parseJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  s: string,
): T {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/json-parse.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/json-parse.ts tests/json-parse.test.ts
git commit -m "feat(api): add shared json-parse helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `lib/api-response.ts` — one response envelope

Routes today hand-roll responses three different ways: `NextResponse.json({error}, {status})`, `NextResponse.json({ok:true})`, and `new Response(JSON.stringify({error}),...)` (in `lib/workspace.ts`). This task gives one set of helpers, using the **web-standard `Response`** to match `lib/workspace.ts:43-45` and stay test-friendly.

**Files:**
- Create: `lib/api-response.ts`
- Test: `tests/api-response.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/api-response.test.ts
import { describe, it, expect } from "vitest";
import { json, created, error, badRequest, unauthorized, forbidden, notFound } from "@/lib/api-response";

describe("api-response", () => {
  it("json() defaults to 200 and echoes data", async () => {
    const r = json({ a: 1 });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(await r.json()).toEqual({ a: 1 });
  });

  it("created() is 201", () => {
    expect(created({ id: "x" }).status).toBe(201);
  });

  it("error() wraps the message under `error`", async () => {
    const r = error(418, "teapot");
    expect(r.status).toBe(418);
    expect(await r.json()).toEqual({ error: "teapot" });
  });

  it("named helpers carry the right status and default message", async () => {
    expect(badRequest().status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    const nf = notFound();
    expect(nf.status).toBe(404);
    expect(await nf.json()).toEqual({ error: "Not found" });
  });

  it("serializes Date fields to ISO strings (NextResponse.json parity)", async () => {
    const r = json({ at: new Date("2026-01-02T03:04:05.000Z") });
    expect(await r.json()).toEqual({ at: "2026-01-02T03:04:05.000Z" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-response.test.ts`
Expected: FAIL — cannot find module `@/lib/api-response`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/api-response.ts
const jsonHeaders = { "content-type": "application/json" } as const;

function build(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

/** Success envelope: data as-is with a status (default 200). */
export function json<T>(data: T, status = 200): Response {
  return build(data, status);
}

/** 201 Created. */
export function created<T>(data: T): Response {
  return build(data, 201);
}

/** Error envelope: { error: message } with a status. */
export function error(status: number, message: string): Response {
  return build({ error: message }, status);
}

export const badRequest = (message = "Bad request"): Response => error(400, message);
export const unauthorized = (message = "Unauthorized"): Response => error(401, message);
export const forbidden = (message = "Forbidden"): Response => error(403, message);
export const notFound = (message = "Not found"): Response => error(404, message);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api-response.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/api-response.ts tests/api-response.test.ts
git commit -m "feat(api): add response envelope helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `lib/api-handler.ts` — guard-callback helpers

The pattern `const a = await requireApiRole("EDITOR"); if ("response" in a) return a.response;` appears in ~28 routes. This task centralizes it. `runGuarded` is a pure function (no cookies/DB) so it is unit-tested; `withWorkspace`/`withRole` are thin adapters over the existing guards in `lib/workspace.ts:79-93`.

**Files:**
- Create: `lib/api-handler.ts`
- Test: `tests/api-handler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/api-handler.test.ts
import { describe, it, expect } from "vitest";
import { runGuarded } from "@/lib/api-handler";
import type { WorkspaceCtx } from "@/lib/workspace";

const fakeCtx: WorkspaceCtx = {
  user: { id: "u1", email: "a@b.com", name: "A", onboarded: true },
  workspace: { id: "w1", name: "W", slug: "w" },
  role: "EDITOR",
};

describe("runGuarded", () => {
  it("runs the handler with the ctx when the guard passes", async () => {
    const r = await runGuarded(fakeCtx, (ws) => new Response(ws.workspace.id));
    expect(await r.text()).toBe("w1");
  });

  it("short-circuits with the guard's response and never calls the handler", async () => {
    let called = false;
    const blocked = await runGuarded({ response: new Response("nope", { status: 403 }) }, () => {
      called = true;
      return new Response("should not run");
    });
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toBe("nope");
    expect(called).toBe(false);
  });

  it("awaits an async handler", async () => {
    const r = await runGuarded(fakeCtx, async () => new Response("ok"));
    expect(await r.text()).toBe("ok");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-handler.test.ts`
Expected: FAIL — cannot find module `@/lib/api-handler`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/api-handler.ts
import { requireApiRole, requireApiWorkspace, type Role, type WorkspaceCtx } from "./workspace";

type Guarded = WorkspaceCtx | { response: Response };

/**
 * Pure core: if the guard short-circuited, return its Response untouched;
 * otherwise invoke `fn` with the resolved workspace context.
 */
export async function runGuarded(
  guard: Guarded,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  if ("response" in guard) return guard.response;
  return fn(guard);
}

/** Require any workspace membership (VIEWER+), then run `fn` with the workspace context. */
export async function withWorkspace(
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiWorkspace(), fn);
}

/** Require at least `min` role, then run `fn` with the workspace context. */
export async function withRole(
  min: Role,
  fn: (ws: WorkspaceCtx) => Response | Promise<Response>,
): Promise<Response> {
  return runGuarded(await requireApiRole(min), fn);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api-handler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/api-handler.ts tests/api-handler.test.ts
git commit -m "feat(api): add withWorkspace/withRole guard helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: zod schemas + `parseBody`

Add request validation. zod is **not yet installed**. Use only the version-stable subset (`z.string`, `.min`, `.max`, `.regex`, `.optional`, `.array`, `.unknown`, `.object`, `.safeParse`, `z.infer`) and a **regex for email** (avoids the `z.string().email()` vs `z.email()` divergence between zod v3 and v4, and matches the regex the codebase already uses at `app/api/auth/signup/route.ts:16`).

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `lib/schemas.ts`
- Test: `tests/schemas.test.ts`

- [ ] **Step 1: Install zod**

Run: `npm install zod`
Expected: `package.json` `dependencies` now lists `zod`. Confirm with `node -e "require('zod')"` (no output, exit 0).

- [ ] **Step 2: Write the failing test**

```ts
// tests/schemas.test.ts
import { describe, it, expect } from "vitest";
import { createPageSchema, updateComponentSchema, emailField } from "@/lib/schemas";

describe("createPageSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(createPageSchema.safeParse({}).success).toBe(true);
  });
  it("accepts a valid title + content array", () => {
    expect(createPageSchema.safeParse({ title: "Home", content: [{ type: "hero" }] }).success).toBe(true);
  });
  it("rejects a non-string title", () => {
    expect(createPageSchema.safeParse({ title: 123 }).success).toBe(false);
  });
  it("rejects a title over 120 chars", () => {
    expect(createPageSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
  });
});

describe("updateComponentSchema", () => {
  it("accepts a name and content", () => {
    expect(updateComponentSchema.safeParse({ name: "Card", content: [] }).success).toBe(true);
  });
  it("rejects a non-array content", () => {
    expect(updateComponentSchema.safeParse({ content: { not: "array" } }).success).toBe(false);
  });
});

describe("emailField", () => {
  it("accepts a valid email", () => {
    expect(emailField.safeParse("a@b.com").success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(emailField.safeParse("nope").success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — cannot find module `@/lib/schemas`.

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/schemas.ts
import { z } from "zod";
import { badRequest } from "./api-response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reusable email validator (regex matches the existing inline checks in auth routes). */
export const emailField = z.string().regex(EMAIL_RE, "Enter a valid email address.");

export const createPageSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.array(z.unknown()).optional(),
});

export const updateComponentSchema = z.object({
  name: z.string().max(80).optional(),
  content: z.array(z.unknown()).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;

/**
 * Read + validate a JSON request body. Mirrors the guard pattern:
 * returns `{ data }` on success or `{ response }` (400) on failure, so callers
 * unwrap with `if ("response" in parsed) return parsed.response;`.
 * Invalid JSON is treated as `{}` (same as the current `req.json().catch(() => ({}))`).
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { response: Response }> {
  const raw = await req.json().catch(() => ({}));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    return { response: badRequest(message) };
  }
  return { data: result.data };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/schemas.ts tests/schemas.test.ts
git commit -m "feat(api): add zod request schemas and parseBody helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate the components routes (canonical worked example)

This is the **reference migration** — the exact before→after for all three concerns. Later tasks apply the same transforms.

> **No new tests here** (no route/Prisma harness exists). Safety net: existing `npm test` stays green, `npx tsc --noEmit` passes, `npm run build` passes, and a manual `curl` smoke check. The change is behavior-preserving.

**Files:**
- Modify: `app/api/components/route.ts`
- Modify: `app/api/components/[id]/route.ts`

- [ ] **Step 1: Rewrite `app/api/components/route.ts`**

Replace the whole file with:

```ts
import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api-handler";
import { json, created } from "@/lib/api-response";
import { parseJsonArray } from "@/lib/json-parse";

export const dynamic = "force-dynamic";

// GET /api/components — list all reusable components
export async function GET() {
  return withWorkspace(async (ws) => {
    const comps = await prisma.component.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { updatedAt: "desc" },
    });
    return json(
      comps.map((c) => ({
        id: c.id,
        name: c.name,
        content: parseJsonArray(c.content),
        updatedAt: c.updatedAt.toISOString(),
      })),
    );
  });
}

// POST /api/components — create from a block subtree (editor+)
export async function POST(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "Component").slice(0, 80);
    const content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
    const c = await prisma.component.create({
      data: { name, content, workspaceId: ws.workspace.id },
    });
    return created({ id: c.id, name: c.name, content: parseJsonArray(c.content) });
  });
}
```

- [ ] **Step 2: Rewrite `app/api/components/[id]/route.ts`**

Replace the whole file with:

```ts
import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api-handler";
import { json, notFound } from "@/lib/api-response";
import { parseJsonArray } from "@/lib/json-parse";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;
    const c = await prisma.component.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!c) return notFound();
    return json({ id: c.id, name: c.name, content: parseJsonArray(c.content) });
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: { name?: string; content?: string } = {};
    if (typeof body.name === "string") data.name = body.name.slice(0, 80);
    if (body.content !== undefined) data.content = JSON.stringify(body.content);
    const result = await prisma.component.updateMany({
      where: { id, workspaceId: ws.workspace.id },
      data,
    });
    if (result.count === 0) return notFound();
    const c = await prisma.component.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    return json({ id: c!.id, name: c!.name, content: parseJsonArray(c!.content) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.component.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
```

Note: `safeParse` is gone (now `parseJsonArray`); the guard + unwrap is gone (now `withWorkspace`/`withRole`); the workspace `id` is read from `ws.workspace.id` inside the callback, so it is impossible to run the body without it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full unit suite (must stay green)**

Run: `npm test`
Expected: all existing tests + the 4 new test files PASS.

- [ ] **Step 5: Manual smoke check**

Run: `npm run build`
Expected: build succeeds (compiles the two rewritten routes).
Then, in a dev server (`npm run dev`) while logged in, confirm the component list/create/update/delete still work from the editor UI (Save-as-component flow), and that an unauthenticated `curl` to `/api/components` returns 401:
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/components` → `401`.

- [ ] **Step 6: Commit**

```bash
git add app/api/components/route.ts app/api/components/[id]/route.ts
git commit -m "refactor(api): migrate components routes to guard + response helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migrate the pages routes (+ introduce schema validation)

Apply the Task-5 transforms to the pages routes, and use `createPageSchema`/`parseBody` on POST as the first validation example.

**Files:**
- Modify: `app/api/pages/route.ts`
- Modify: `app/api/pages/[id]/route.ts`

- [ ] **Step 1: Rewrite `app/api/pages/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/page-service";
import { withWorkspace, withRole } from "@/lib/api-handler";
import { json, created } from "@/lib/api-response";
import { parseBody, createPageSchema } from "@/lib/schemas";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/pages — list pages in the active workspace (newest first)
export async function GET() {
  return withWorkspace(async (ws) => {
    const pages = await prisma.page.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { updatedAt: "desc" },
    });
    return json(pages);
  });
}

// POST /api/pages — create a page in the active workspace (editor+)
export async function POST(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const parsed = await parseBody(req, createPageSchema);
    if ("response" in parsed) return parsed.response;
    const title = (parsed.data.title || "Untitled Page").slice(0, 120);
    const slug = await uniqueSlug(title);
    const content = JSON.stringify(parsed.data.content ?? []);
    const page = await prisma.page.create({
      data: { title, slug, content, workspaceId: ws.workspace.id },
    });
    await logActivity(ws.workspace.id, ws.user.id, "page.created", page.id, { title });
    return created(page);
  });
}
```

- [ ] **Step 2: Rewrite `app/api/pages/[id]/route.ts`**

Keep the existing PUT validation logic (it handles nested `seo`, which is out of scope for a schema right now), just swap guards + responses:

```ts
import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api-handler";
import { json, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/pages/:id
export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();
    return json(page);
  });
}

// PUT /api/pages/:id — update title and/or content
export async function PUT(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: {
      title?: string;
      content?: string;
      theme?: string;
      metaTitle?: string | null;
      metaDescription?: string | null;
      ogImage?: string | null;
    } = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 120);
    if (body.content !== undefined) data.content = JSON.stringify(body.content);
    if (body.theme !== undefined) data.theme = JSON.stringify(body.theme);
    if (body.seo) {
      if (body.seo.metaTitle !== undefined) data.metaTitle = body.seo.metaTitle || null;
      if (body.seo.metaDescription !== undefined) data.metaDescription = body.seo.metaDescription || null;
      if (body.seo.ogImage !== undefined) data.ogImage = body.seo.ogImage || null;
    }
    const result = await prisma.page.updateMany({ where: { id, workspaceId: ws.workspace.id }, data });
    if (result.count === 0) return notFound();
    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    return json(page);
  });
}

// DELETE /api/pages/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.page.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    return json({ ok: true });
  });
}
```

- [ ] **Step 3: Typecheck + tests + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

- [ ] **Step 4: Manual smoke check**

In `npm run dev`, confirm page list/create/edit/publish still work from the dashboard + editor. Verify `POST /api/pages` with a bad body returns 400:
`curl -s -X POST http://localhost:3000/api/pages -H 'content-type: application/json' -d '{"title":123}' --cookie 'pc_session=<valid>'` → `{"error":"..."}` 400. (Get a valid `pc_session` from your browser dev tools while logged in.)

- [ ] **Step 5: Commit**

```bash
git add app/api/pages/route.ts app/api/pages/[id]/route.ts
git commit -m "refactor(api): migrate pages routes to guards + add schema validation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Sweep the remaining routes + dedupe `safeParse`

Apply the Task-5 transforms to every remaining route. **The transforms are exactly:**

1. **Guard:** `const a = await requireApiWorkspace(); if ("response" in a) return a.response;` → wrap the body in `return withWorkspace(async (ws) => { ... })`. For `requireApiRole("X")` → `return withRole("X", async (ws) => { ... })`. Replace every `a.workspace.id`/`a.user.id` with `ws.workspace.id`/`ws.user.id`. Remove the now-unused imports from `@/lib/workspace`.
2. **Responses:** `NextResponse.json(x)` → `json(x)`; `NextResponse.json(x, { status: 201 })` → `created(x)`; `NextResponse.json({ error: m }, { status: 404 })` → `notFound(m)` (and `400`→`badRequest`, `401`→`unauthorized`, `403`→`forbidden`); `NextResponse.json({ ok: true })` → `json({ ok: true })`. Drop the `import { NextResponse }` once unused.
3. **JSON parse:** any local `safeParse`/`safe` returning an array → import + use `parseJsonArray`; any returning an object → `parseJsonObject`. Delete the local copy.

> Leave **public** routes (no auth) alone for the guard step — only migrate their responses/parse. The one public handler is `POST /api/submissions` (`app/api/submissions/route.ts:8-24`); its `GET` is workspace-scoped and **does** get the guard transform.
> Do **not** touch `app/api/auth/*` guard logic (they use `requireApiUser`/session directly, not workspace guards) — only migrate their response helpers if desired, otherwise skip.

**Files to migrate (checklist — tick each after typecheck passes):**

- [ ] `app/api/submissions/route.ts` — GET → `withWorkspace`; both → response helpers; replace object `safeParse` (line 52) with `parseJsonObject`. (Behavior note: `parseJsonObject` returns `{}` for a JSON array; submission data is always an object, so this is safe and stricter.)
- [ ] `app/api/activity/route.ts` — GET → `withWorkspace`; replace `safe` (line 37) with `parseJsonObject`; responses.
- [ ] `app/api/site/route.ts`
- [ ] `app/api/assets/route.ts`
- [ ] `app/api/upload/route.ts`
- [ ] `app/api/collections/route.ts`
- [ ] `app/api/collections/[id]/route.ts`
- [ ] `app/api/collections/[id]/items/route.ts`
- [ ] `app/api/collections/[id]/items/[itemId]/route.ts`
- [ ] `app/api/pages/[id]/publish/route.ts`
- [ ] `app/api/pages/[id]/versions/route.ts`
- [ ] `app/api/pages/[id]/versions/[versionId]/route.ts`
- [ ] `app/api/workspaces/route.ts`
- [ ] `app/api/workspaces/[id]/route.ts`
- [ ] `app/api/workspaces/switch/route.ts`
- [ ] `app/api/workspaces/members/route.ts` (uses `requireApiRole("ADMIN")` → `withRole("ADMIN", ...)`)
- [ ] `app/api/workspaces/invites/route.ts` (`withRole("ADMIN", ...)`; reuse `emailField` from schemas for the email check)
- [ ] `app/api/invites/[token]/route.ts`
- [ ] `app/api/account/route.ts`
- [ ] `app/api/account/password/route.ts`
- [ ] `app/api/ai/route.ts` (uses `requireApiRole`; keep AI logic intact, only swap guard + responses)

For each file:
- [ ] **Step A:** apply transforms 1–3 above.
- [ ] **Step B:** `npx tsc --noEmit` (run after each file, or every few files) — fix any unused-import errors.

- [ ] **Final Step 1: Confirm no stragglers remain**

Run: `grep -rn "if (\"response\" in a)" app/api && echo "STRAGGLERS ABOVE" || echo "clean"`
Expected: `clean` (every guard now goes through `withWorkspace`/`withRole`). Auth routes using `requireApiUser` won't match this pattern and are fine.

Run: `grep -rn "function safeParse\|function safe(" app/api && echo "DUPES ABOVE" || echo "clean"`
Expected: `clean` (all local parse copies removed).

- [ ] **Final Step 2: Full verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

- [ ] **Final Step 3: Manual regression pass**

In `npm run dev`, log in and exercise: dashboard (pages CRUD), editor save/publish, CMS collections + items, components, assets/upload, workspace switch, members/invites, activity feed, AI generate, a public published page form submission. Confirm no 500s in the server log.

- [ ] **Final Step 4: Commit**

```bash
git add app/api
git commit -m "refactor(api): migrate remaining routes to guard/response/parse helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] **Spec coverage:** all four named deliverables exist — `api-response.ts` (Task 2), `json-parse.ts` (Task 1), guard helpers / "apiRoute wrapper" (Task 3), zod schemas (Task 4) — and routes are migrated (Tasks 5–7).
- [ ] **No `NextResponse`/manual-guard/`safeParse` left in `app/api`** except the deliberately-skipped auth routes (`grep` checks in Task 7).
- [ ] **Name consistency:** `parseJsonArray`, `parseJsonObject`, `json`, `created`, `error`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `runGuarded`, `withWorkspace`, `withRole`, `parseBody`, `createPageSchema`, `updateComponentSchema`, `emailField` — used identically everywhere they appear.
- [ ] **Tenancy:** every migrated handler reads the workspace id from the `ws` callback param, not a free-standing guard result.
- [ ] `npx tsc --noEmit && npm test && npm run build` all green.

---

## Follow-on plans (outline only — to be expanded into their own files)

### Plan 2 — Editor UI refactor (`docs/superpowers/plans/<date>-editor-ui.md`)
Largest LOC reduction; mostly UI so verified by component tests + manual checks rather than pure unit TDD.
- **Shared `<Modal>`** (`components/editor/Modal.tsx`): extract the Framer-Motion backdrop/dialog duplicated across `SaveComponentModal`, `UnsavedModal`, `CmsManagerModal`. Migrate all three.
- **`FIELD_INPUT_MAP`** (`lib/field-inputs.ts`): one `fieldType → input component` map; replace the divergent switches in `Inspector.tsx` (`ContentField`, 12 cases) and `CmsManagerModal.tsx` (`ItemFieldInput`, 6 cases). Adding a field type becomes a one-line map entry.
- **Data-driven style groups** (`lib/style-groups.ts`): a `STYLE_GROUP_SCHEMAS` config replacing the hardcoded `StyleGroupView` switch in `Inspector.tsx:200-262`.
- **Split `Inspector.tsx` (888 LOC)** into `InspectorPanel` (floating chrome: drag/resize/dock), `InspectorContent` (tabs), `StyleInspector`, `StyleGroupView`, and `inspector/useStyleField.ts` + `StyleFieldComponents.tsx`.
- **Extract hooks from `EditorClient.tsx` (720 LOC)**: `useKeyboardShortcuts` (lines 444-539), `useDragDropManager` (541-621), `usePersistence` (265-352), `usePageNavigation` (355-394).
- **Re-render fix:** add a `useSelectedBlock()` selector and scope `FloatingInspector`'s position recompute to the selected block instead of the whole `tree` (currently recomputes on every keystroke — `Inspector.tsx:670, 796-800`).
- **Store cleanup:** resolve the `editor-store.viewport` vs `breakpoints.activeId` overlap into one source of truth.

### Plan 3 — Block registry as single-file plugins (`docs/superpowers/plans/<date>-block-registry.md`)
Goal: adding a block touches **one file** instead of three spots.
- **Co-locate definition + Render:** each block in `components/blocks/*.tsx` exports its own `BlockDefinition` (Render paired with schema/defaults/fields) instead of the definition living separately in `lib/registry.ts`.
- **Split `lib/registry.ts` (726 LOC)** into `lib/blocks/{layout,basic,sections,dynamic}.ts`, each exporting `BlockDefinition[]`; `lib/registry.ts` becomes a thin collector (`Object.fromEntries`, `getDefinition`, `createBlock`, `CATEGORIES` derived from the modules).
- **`containerStrategy` on `BlockDefinition`:** move the hardcoded `columns` special-case out of `EditorBlock.tsx:97-110` onto the definition, so container rendering is generic.
- **Verification:** the existing `tests/tree.test.ts` / store tests must stay green; add a registry-integrity test (every `type` key matches its definition's `type`, every `CATEGORIES` entry resolves, every container has a valid child strategy).
