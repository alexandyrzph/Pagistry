# Page Preview Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gradient+letter placeholder on each dashboard page card with a real, cached screenshot of the rendered page (Webflow-style), regenerated lazily when the page is viewed and out of date.

**Architecture:** A new token-gated render route (`/internal/shot/[id]`) reuses the exact public-page render so Playwright can screenshot any page (published or draft). A server-only screenshot service drives a singleton Chromium, writes a PNG to `public/uploads/thumbnails/`, and records it in a new `PageThumbnail` row. The dashboard shows the cached image immediately and a small client queue (max 2 concurrent) fires `POST /api/pages/[id]/thumbnail` for stale/missing cards, swapping in the fresh image when ready.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` auth gate), Prisma + SQLite (`db push`, no migrations dir), Playwright (already a devDependency), Vitest (node + jsdom projects), node:crypto HMAC.

---

## Deviation from spec (intentional)

The spec proposed two fields on `Page` (`thumbnailUrl`, `thumbnailAt`). During planning we found this creates an infinite-regen loop: `Page.updatedAt` is `@updatedAt`, so writing `thumbnailAt` bumps `updatedAt`, making the page instantly stale again. **Fix:** store the thumbnail in a separate `PageThumbnail` model (1:1 with `Page`). Writing it never touches `Page.updatedAt`, and staleness is `thumbnail.takenForUpdatedAt < page.updatedAt`. Everything else matches the spec.

## File structure

| File                                     | Responsibility                                                     | Action |
| ---------------------------------------- | ------------------------------------------------------------------ | ------ |
| `prisma/schema.prisma`                   | `PageThumbnail` model + `Page.thumbnail` relation                  | Modify |
| `lib/thumbnails/staleness.ts`            | Pure staleness predicate                                           | Create |
| `lib/thumbnails/token.ts`                | HMAC sign/verify of shot tokens                                    | Create |
| `lib/thumbnails/queue.ts`                | Pure client-side concurrency limiter                               | Create |
| `lib/thumbnails/screenshot.ts`           | Server-only Playwright capture + singleton browser + per-page lock | Create |
| `components/PageDocument.tsx`            | Shared faithful page render (style + main)                         | Create |
| `app/p/[slug]/page.tsx`                  | Public page — refactor to use `PageDocument`                       | Modify |
| `app/internal/shot/[id]/page.tsx`        | Token-gated render route for screenshots                           | Create |
| `app/api/pages/[id]/thumbnail/route.ts`  | POST: regenerate screenshot if stale                               | Create |
| `app/api/pages/[id]/route.ts`            | DELETE: best-effort delete PNG file                                | Modify |
| `proxy.ts`                               | Add `/internal/` to public bypass                                  | Modify |
| `components/dashboard/PageThumbnail.tsx` | Card thumbnail: img / gradient fallback / shimmer + triggers regen | Create |
| `components/dashboard/Dashboard.tsx`     | Use `PageThumbnail`; extend `PageItem`                             | Modify |
| `app/(app)/page.tsx`                     | Add thumbnail fields to the DTO                                    | Modify |
| `.env`                                   | `THUMBNAIL_SECRET`, optional `APP_URL`                             | Modify |
| `tests/thumbnail-staleness.test.ts`      | Unit test                                                          | Create |
| `tests/thumbnail-token.test.ts`          | Unit test                                                          | Create |
| `tests/thumbnail-queue.test.ts`          | Unit test                                                          | Create |
| `tests/page-thumbnail.dom.test.tsx`      | Component render test                                              | Create |

**Testing philosophy (matches this codebase):** `tests/` holds pure-logic tests (`*.test.ts`) and component tests (`*.dom.test.tsx`). There are **no** route-handler/DB integration tests here, so we don't add one — instead we keep all decision logic in pure modules (staleness, token, queue) and test those, plus a dom test for the card. The screenshot service and routes are verified manually (Task 13).

**Gate:** `npx tsc --noEmit` + `npm test`. Do **not** run `next build` (it clobbers the running `next dev`).

---

### Task 1: `PageThumbnail` model + relation

**Files:**

- Modify: `prisma/schema.prisma` (Page model ~lines 10-29; add new model after it)

- [ ] **Step 1: Add the relation field to `Page`**

In `model Page`, add this line alongside the other relations (`submissions`, `versions`):

```prisma
  thumbnail   PageThumbnail?
```

- [ ] **Step 2: Add the `PageThumbnail` model**

Add immediately after `model Page { ... }`:

```prisma
model PageThumbnail {
  pageId            String   @id
  page              Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  url               String   // e.g. "/uploads/thumbnails/<pageId>.png"
  takenForUpdatedAt DateTime // the Page.updatedAt value this screenshot reflects
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 3: Apply the schema and regenerate the client**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." and "Generated Prisma Client".

- [ ] **Step 4: Verify the type exists**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The `prisma.pageThumbnail` delegate and `Page.thumbnail` relation now type-check.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add PageThumbnail model for cached page previews"
```

> Note: `prisma/dev.db` may also show as modified — leave it unstaged unless the team commits the dev DB.

---

### Task 2: Pure staleness predicate (TDD)

**Files:**

- Create: `lib/thumbnails/staleness.ts`
- Test: `tests/thumbnail-staleness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/thumbnail-staleness.test.ts
import { describe, it, expect } from "vitest";
import { isThumbnailStale } from "@/lib/thumbnails/staleness";

describe("isThumbnailStale", () => {
  const updated = new Date("2026-06-16T12:00:00Z");

  it("is stale when never taken", () => {
    expect(isThumbnailStale(null, updated)).toBe(true);
    expect(isThumbnailStale(undefined, updated)).toBe(true);
  });

  it("is stale when the shot predates the last edit", () => {
    expect(isThumbnailStale(new Date("2026-06-16T11:59:59Z"), updated)).toBe(true);
  });

  it("is fresh when the shot matches or postdates the last edit", () => {
    expect(isThumbnailStale(updated, updated)).toBe(false);
    expect(isThumbnailStale(new Date("2026-06-16T12:00:01Z"), updated)).toBe(false);
  });

  it("accepts ISO strings", () => {
    expect(isThumbnailStale("2026-06-16T11:00:00Z", "2026-06-16T12:00:00Z")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/thumbnail-staleness.test.ts`
Expected: FAIL — "Failed to resolve import @/lib/thumbnails/staleness".

- [ ] **Step 3: Write the implementation**

```ts
// lib/thumbnails/staleness.ts

/**
 * A page's cached thumbnail is stale when it was never taken, or was taken
 * for an older version of the page than the current one.
 *
 * @param takenForUpdatedAt the Page.updatedAt the existing shot reflects (or null/undefined)
 * @param pageUpdatedAt     the page's current updatedAt
 */
export function isThumbnailStale(
  takenForUpdatedAt: Date | string | null | undefined,
  pageUpdatedAt: Date | string,
): boolean {
  if (!takenForUpdatedAt) return true;
  return new Date(takenForUpdatedAt).getTime() < new Date(pageUpdatedAt).getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/thumbnail-staleness.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/thumbnails/staleness.ts tests/thumbnail-staleness.test.ts
git commit -m "feat(thumbnails): pure staleness predicate"
```

---

### Task 3: Shot token sign/verify (TDD)

**Files:**

- Create: `lib/thumbnails/token.ts`
- Test: `tests/thumbnail-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/thumbnail-token.test.ts
import { describe, it, expect } from "vitest";
import { signShotToken, verifyShotToken } from "@/lib/thumbnails/token";

describe("shot token", () => {
  const NOW = 1_000_000_000_000;

  it("verifies a freshly signed token", () => {
    const t = signShotToken("page1", NOW);
    expect(verifyShotToken("page1", t, NOW)).toBe(true);
  });

  it("rejects a token for a different page id", () => {
    const t = signShotToken("page1", NOW);
    expect(verifyShotToken("page2", t, NOW)).toBe(false);
  });

  it("rejects an expired token", () => {
    const t = signShotToken("page1", NOW);
    expect(verifyShotToken("page1", t, NOW + 61_000)).toBe(false);
  });

  it("rejects malformed/tampered tokens", () => {
    expect(verifyShotToken("page1", "garbage", NOW)).toBe(false);
    expect(verifyShotToken("page1", "", NOW)).toBe(false);
    const t = signShotToken("page1", NOW);
    expect(verifyShotToken("page1", t + "x", NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/thumbnail-token.test.ts`
Expected: FAIL — cannot resolve `@/lib/thumbnails/token`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/thumbnails/token.ts
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.THUMBNAIL_SECRET || "dev-thumbnail-secret-change-me";
const TTL_MS = 60_000; // tokens are valid for 60s — long enough for one capture

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** Token shape: "<expiryMs>.<hmac(id.expiryMs)>" */
export function signShotToken(id: string, now: number = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${sign(`${id}.${exp}`)}`;
}

export function verifyShotToken(id: string, token: string, now: number = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = sign(`${id}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/thumbnail-token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/thumbnails/token.ts tests/thumbnail-token.test.ts
git commit -m "feat(thumbnails): HMAC shot tokens for the internal render route"
```

---

### Task 4: Client concurrency limiter (TDD)

**Files:**

- Create: `lib/thumbnails/queue.ts`
- Test: `tests/thumbnail-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/thumbnail-queue.test.ts
import { describe, it, expect } from "vitest";
import { createLimiter } from "@/lib/thumbnails/queue";

/** A promise whose resolution we control manually. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("createLimiter", () => {
  it("never runs more than `max` tasks at once", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred<void>());

    const runs = gates.map((g, i) =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await g.promise;
        active--;
        return i;
      }),
    );

    // Let the limiter schedule the first batch.
    await Promise.resolve();
    await Promise.resolve();
    expect(active).toBe(2);

    // Resolve gates one at a time; peak must never exceed 2.
    for (const g of gates) {
      g.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    const results = await Promise.all(runs);
    expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("propagates task rejections to the caller", async () => {
    const limit = createLimiter(1);
    await expect(
      limit(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/thumbnail-queue.test.ts`
Expected: FAIL — cannot resolve `@/lib/thumbnails/queue`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/thumbnails/queue.ts

/**
 * Returns a `limit(task)` function that runs at most `max` async tasks
 * concurrently; excess tasks queue and run as slots free up. Used so a
 * dashboard full of cards doesn't fire dozens of screenshot requests at once.
 */
export function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < max && queue.length > 0) {
      active++;
      queue.shift()!();
    }
  };

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            pump();
          });
      });
      pump();
    });
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/thumbnail-queue.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/thumbnails/queue.ts tests/thumbnail-queue.test.ts
git commit -m "feat(thumbnails): client concurrency limiter"
```

---

### Task 5: Extract `PageDocument` shared render

**Files:**

- Create: `components/PageDocument.tsx`
- Modify: `app/p/[slug]/page.tsx`

- [ ] **Step 1: Create `PageDocument`**

This is the body of the current public page, lifted verbatim, parameterized by `page` and `animate`.

```tsx
// components/PageDocument.tsx
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { responsiveCss } from "@/lib/blocks/styles";
import { designSystemCss, parseDesignSystem } from "@/lib/design/design-system";
import { themeVars, parseTheme } from "@/lib/design/theme";
import { buildCollectionMap } from "@/lib/cms/collection-service";
import { BlockRenderer } from "@/components/BlockRenderer";

type PageRow = { content: string; theme: string; workspaceId: string | null };

/**
 * Renders a page exactly as the public site does — shared by the public route
 * (`/p/[slug]`) and the internal screenshot route (`/internal/shot/[id]`).
 * Pass `animate={false}` for screenshots so the capture is the final frame.
 */
export async function PageDocument({ page, animate = true }: { page: PageRow; animate?: boolean }) {
  const tree = parseContent(page.content);
  const theme = parseTheme(page.theme);

  // shared site header + footer (scoped to this page's workspace)
  const site = page.workspaceId
    ? await prisma.site.findUnique({ where: { workspaceId: page.workspaceId } })
    : null;
  const header = site ? parseContent(site.header) : [];
  const footer = site ? parseContent(site.footer) : [];
  const ds = parseDesignSystem(site);

  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...tree, ...footer]);

  const comps = await prisma.component.findMany({ where: { workspaceId: page.workspaceId } });
  const components: Record<string, { content: any[] }> = {};
  for (const c of comps) {
    try {
      components[c.id] = { content: JSON.parse(c.content) };
    } catch {
      components[c.id] = { content: [] };
    }
  }

  const collectionRows = await prisma.collection.findMany({
    where: { workspaceId: page.workspaceId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const collections = buildCollectionMap(collectionRows);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main style={themeVars(theme)}>
        {header.length > 0 && (
          <BlockRenderer
            tree={header}
            viewport="desktop"
            animate={animate}
            inlineStyles={false}
            components={components}
            collections={collections}
          />
        )}
        <BlockRenderer
          tree={tree}
          viewport="desktop"
          animate={animate}
          inlineStyles={false}
          components={components}
          collections={collections}
        />
        {footer.length > 0 && (
          <BlockRenderer
            tree={footer}
            viewport="desktop"
            animate={animate}
            inlineStyles={false}
            components={components}
            collections={collections}
          />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Refactor `app/p/[slug]/page.tsx` to use it**

Replace the file's default export (keep `generateMetadata` and the imports it needs: `Metadata`, `notFound`, `prisma`). The render assembly moves into `PageDocument`; the public route keeps the published-gate and JSON-LD.

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageDocument } from "@/components/PageDocument";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) return { title: "Page not found" };

  const title = page.metaTitle || page.title;
  const description = page.metaDescription || undefined;
  const images = page.ogImage ? [page.ogImage] : undefined;

  return {
    title,
    description,
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page || !page.published) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
    url: `https://pagistry.com/p/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageDocument page={page} />
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manually confirm the public page still renders**

With `next dev` running, open an existing **published** page at `http://localhost:3000/p/<slug>` and confirm it looks identical to before (header/footer, styles, content).

- [ ] **Step 5: Commit**

```bash
git add components/PageDocument.tsx app/p/[slug]/page.tsx
git commit -m "refactor(render): extract shared PageDocument from public page"
```

---

### Task 6: Token-gated internal render route + proxy bypass

**Files:**

- Create: `app/internal/shot/[id]/page.tsx`
- Modify: `proxy.ts`

- [ ] **Step 1: Add `/internal/` to the proxy public bypass**

In `proxy.ts`, update the never-gate check (currently `/api`, `/p/`, `/c/`):

```ts
// Never gate: API (handlers enforce), published pages, the internal
// screenshot render route (token-gated), Next internals.
if (
  pathname.startsWith("/api") ||
  pathname.startsWith("/p/") ||
  pathname.startsWith("/c/") ||
  pathname.startsWith("/internal/")
) {
  return NextResponse.next();
}
```

- [ ] **Step 2: Create the internal shot route**

```tsx
// app/internal/shot/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyShotToken } from "@/lib/thumbnails/token";
import { PageDocument } from "@/components/PageDocument";

export const dynamic = "force-dynamic";

/**
 * Internal-only: renders any page (published or draft) for the screenshot
 * service. Reachable only with a valid signed `?t=` token, never linked in the
 * UI. Renders with animations off so a screenshot captures the final frame.
 */
export default async function ShotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!t || !verifyShotToken(id, t)) notFound();

  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();

  return <PageDocument page={page} animate={false} />;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manually confirm token gating**

With `next dev` running:

- Open `http://localhost:3000/internal/shot/<realPageId>` (no token) → expect the 404 page (NOT a redirect to `/login`).
- In a node REPL or temporary script, `signShotToken(id)` and open `http://localhost:3000/internal/shot/<id>?t=<token>` → expect the rendered page (works even for an unpublished draft).

- [ ] **Step 5: Commit**

```bash
git add app/internal/shot/[id]/page.tsx proxy.ts
git commit -m "feat(thumbnails): token-gated internal render route for screenshots"
```

---

### Task 7: Screenshot service (Playwright)

**Files:**

- Create: `lib/thumbnails/screenshot.ts`

> Not unit-tested (drives a real browser); verified in Task 13. Keep it thin — all decision logic lives in the pure modules already tested.

- [ ] **Step 1: Ensure the Chromium binary is installed**

Run: `npx playwright install chromium`
Expected: downloads/install confirmation (or "is already installed").

- [ ] **Step 2: Write the service**

```ts
// lib/thumbnails/screenshot.ts
import { chromium, type Browser } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { signShotToken } from "@/lib/thumbnails/token";

const THUMB_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 800 };

// Reuse one Chromium across shots; stash on globalThis so dev HMR doesn't leak browsers.
const g = globalThis as unknown as { __pcShotBrowser?: Promise<Browser> };
function getBrowser(): Promise<Browser> {
  if (!g.__pcShotBrowser) {
    g.__pcShotBrowser = chromium.launch({ args: ["--no-sandbox"] }).catch((e) => {
      g.__pcShotBrowser = undefined; // allow a later retry
      throw e;
    });
  }
  return g.__pcShotBrowser;
}

export type ShotResult = { url: string; takenForUpdatedAt: Date };

// Dedupe concurrent captures of the same page.
const inFlight = new Map<string, Promise<ShotResult>>();

/** Capture (or reuse an in-flight capture of) the page's preview screenshot. */
export function captureThumbnail(pageId: string): Promise<ShotResult> {
  const existing = inFlight.get(pageId);
  if (existing) return existing;
  const p = run(pageId).finally(() => inFlight.delete(pageId));
  inFlight.set(pageId, p);
  return p;
}

async function run(pageId: string): Promise<ShotResult> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) throw new Error(`Page ${pageId} not found`);
  const takenForUpdatedAt = page.updatedAt; // the version this shot reflects

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  try {
    const pg = await context.newPage();
    const token = signShotToken(pageId);
    await pg.goto(`${APP_URL}/internal/shot/${pageId}?t=${token}`, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    await pg
      .evaluate(() => (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready)
      .catch(() => {});

    await mkdir(THUMB_DIR, { recursive: true });
    await pg.screenshot({ path: path.join(THUMB_DIR, `${pageId}.png`) }); // top of viewport (1280x800)

    const url = `/uploads/thumbnails/${pageId}.png`;
    await prisma.pageThumbnail.upsert({
      where: { pageId },
      create: { pageId, url, takenForUpdatedAt },
      update: { url, takenForUpdatedAt },
    });
    return { url, takenForUpdatedAt };
  } finally {
    await context.close();
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/thumbnails/screenshot.ts
git commit -m "feat(thumbnails): Playwright screenshot service with singleton browser"
```

---

### Task 8: Generation API route

**Files:**

- Create: `app/api/pages/[id]/thumbnail/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/pages/[id]/thumbnail/route.ts
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, notFound, error } from "@/lib/api/api-response";
import { isThumbnailStale } from "@/lib/thumbnails/staleness";
import { captureThumbnail } from "@/lib/thumbnails/screenshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// POST /api/pages/:id/thumbnail — (re)generate the preview screenshot if stale.
// Idempotent: returns the current image untouched when it's already fresh.
export async function POST(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const page = await prisma.page.findFirst({
      where: { id, workspaceId: ws.workspace.id },
      include: { thumbnail: true },
    });
    if (!page) return notFound();

    if (page.thumbnail && !isThumbnailStale(page.thumbnail.takenForUpdatedAt, page.updatedAt)) {
      return json({ url: page.thumbnail.url, version: page.thumbnail.takenForUpdatedAt.getTime() });
    }

    try {
      const shot = await captureThumbnail(id);
      return json({ url: shot.url, version: shot.takenForUpdatedAt.getTime() });
    } catch (e) {
      console.error("[thumbnail] capture failed for", id, e);
      return error(500, "Thumbnail generation failed");
    }
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/pages/[id]/thumbnail/route.ts
git commit -m "feat(thumbnails): POST /api/pages/:id/thumbnail generation endpoint"
```

---

### Task 9: `PageThumbnail` card component (TDD for fallback)

**Files:**

- Create: `components/dashboard/PageThumbnail.tsx`
- Test: `tests/page-thumbnail.dom.test.tsx`

- [ ] **Step 1: Write the failing dom test**

```tsx
// tests/page-thumbnail.dom.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageThumbnail } from "@/components/dashboard/PageThumbnail";

describe("PageThumbnail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("no network in test"))),
    );
  });

  it("shows the cached image (cache-busted) when one exists and it is fresh", () => {
    render(
      <PageThumbnail
        pageId="p1"
        title="Portfolio"
        gradient="from-rose-500 to-pink-600"
        initialUrl="/uploads/thumbnails/p1.png"
        version={42}
        stale={false}
      />,
    );
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/uploads/thumbnails/p1.png?v=42");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to the gradient + first letter when there is no image", () => {
    render(
      <PageThumbnail
        pageId="p2"
        title="acme landing"
        gradient="from-sky-500 to-blue-600"
        initialUrl={null}
        version={null}
        stale={false}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/page-thumbnail.dom.test.tsx`
Expected: FAIL — cannot resolve `@/components/dashboard/PageThumbnail`.

- [ ] **Step 3: Write the component**

```tsx
// components/dashboard/PageThumbnail.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createLimiter } from "@/lib/thumbnails/queue";

// Shared across all cards: at most 2 screenshot requests in flight at once.
const limiter = createLimiter(2);

export function PageThumbnail({
  pageId,
  title,
  gradient,
  initialUrl,
  version,
  stale,
}: {
  pageId: string;
  title: string;
  gradient: string;
  initialUrl: string | null;
  version: number | null;
  stale: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [v, setV] = useState(version);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    setLoading(true);
    limiter(() =>
      fetch(`/api/pages/${pageId}/thumbnail`, { method: "POST" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    )
      .then((d: { url?: string; version?: number } | null) => {
        if (d?.url) {
          setUrl(d.url);
          setV(d.version ?? null);
        }
      })
      .catch(() => {
        /* keep last image / gradient — never break the dashboard */
      })
      .finally(() => setLoading(false));
  }, [stale, pageId]);

  const src = url ? `${url}?v=${v ?? 0}` : null;

  return (
    <div className="relative h-32 overflow-hidden">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <div className={cn("h-full w-full bg-gradient-to-br", gradient)}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-black text-white/90 transition-transform duration-300 group-hover:scale-110">
              {title.charAt(0).toUpperCase() || "P"}
            </span>
          </div>
        </div>
      )}
      {loading && <div className="absolute inset-0 animate-pulse bg-zinc-900/5" />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/page-thumbnail.dom.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PageThumbnail.tsx tests/page-thumbnail.dom.test.tsx
git commit -m "feat(thumbnails): PageThumbnail card component with gradient fallback"
```

---

### Task 10: Wire the dashboard DTO + card

**Files:**

- Modify: `app/(app)/page.tsx`
- Modify: `components/dashboard/Dashboard.tsx`

- [ ] **Step 1: Add thumbnail fields to the server DTO**

In `app/(app)/page.tsx`, add the import, include the relation, and extend the DTO:

```tsx
import { isThumbnailStale } from "@/lib/thumbnails/staleness";
```

```tsx
const pages = await prisma.page.findMany({
  where: { workspaceId: workspace.id },
  orderBy: { updatedAt: "desc" },
  include: { _count: { select: { submissions: true } }, thumbnail: true },
});
const dto = pages.map((p) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  published: p.published,
  updatedAt: p.updatedAt.toISOString(),
  submissions: p._count.submissions,
  thumbnailUrl: p.thumbnail?.url ?? null,
  thumbnailVersion: p.thumbnail?.takenForUpdatedAt.getTime() ?? null,
  thumbnailStale: isThumbnailStale(p.thumbnail?.takenForUpdatedAt, p.updatedAt),
}));
```

- [ ] **Step 2: Extend `PageItem` and import the component in `Dashboard.tsx`**

Add the import near the other imports:

```tsx
import { PageThumbnail } from "./PageThumbnail";
```

Extend the `PageItem` type (after `submissions: number;`):

```tsx
thumbnailUrl: string | null;
thumbnailVersion: number | null;
thumbnailStale: boolean;
```

- [ ] **Step 3: Replace the gradient block with `PageThumbnail`**

In the card's `<Link href={`/editor/${p.id}`} className="block">`, replace the existing gradient `<div className={cn("relative h-32 ...")}>...</div>` (the block containing the centered letter and the LIVE badge) with:

```tsx
<Link href={`/editor/${p.id}`} className="block">
  <div className="relative">
    <PageThumbnail
      pageId={p.id}
      title={p.title}
      gradient={GRADIENTS[i % GRADIENTS.length]}
      initialUrl={p.thumbnailUrl}
      version={p.thumbnailVersion}
      stale={p.thumbnailStale}
    />
    {p.published && (
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 shadow-xs">
        Live
      </span>
    )}
  </div>
</Link>
```

(`GRADIENTS` and `cn` stay in `Dashboard.tsx`; `cn` is still used elsewhere. The `group-hover:scale-110` on the fallback letter resolves against the card's existing `group` class on the `motion.div`.)

- [ ] **Step 4: Type-check + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (tsc clean; all vitest suites green).

- [ ] **Step 5: Commit**

```bash
git add app/(app)/page.tsx components/dashboard/Dashboard.tsx
git commit -m "feat(thumbnails): show cached page previews on the dashboard"
```

---

### Task 11: Delete the PNG when a page is deleted

**Files:**

- Modify: `app/api/pages/[id]/route.ts` (DELETE handler ~lines 48-55)

- [ ] **Step 1: Add file cleanup to the DELETE handler**

Add imports at the top of the file:

```ts
import { unlink } from "fs/promises";
import path from "path";
```

Update the DELETE handler body (the `PageThumbnail` row is removed automatically via `onDelete: Cascade`; this removes the file):

```ts
export async function DELETE(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const result = await prisma.page.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    if (result.count === 0) return notFound();
    // best-effort: remove the cached preview screenshot
    await unlink(path.join(process.cwd(), "public", "uploads", "thumbnails", `${id}.png`)).catch(
      () => {},
    );
    return json({ ok: true });
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/pages/[id]/route.ts
git commit -m "feat(thumbnails): delete cached preview file on page delete"
```

---

### Task 12: Environment configuration

**Files:**

- Modify: `.env`

- [ ] **Step 1: Add the secret (and optional app URL) to `.env`**

Append:

```
# Signs short-lived tokens for the internal screenshot render route.
THUMBNAIL_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
# Base URL Playwright navigates to for screenshots (defaults to http://localhost:3000).
# APP_URL=http://localhost:3000
```

Replace `<generate: ...>` with the actual output of that command.

- [ ] **Step 2: Confirm it loads**

Restart `next dev` so the new env is picked up. (No commit — `.env` is gitignored; verify with `git check-ignore .env`.)

---

### Task 13: Manual end-to-end verification

> No code; confirm the whole feature works against a running `next dev`.

- [ ] **Step 1: Start the app**

Run: `npm run dev` (leave it running).

- [ ] **Step 2: Watch screenshots generate**

Open `http://localhost:3000`. Each card should start on its gradient/last image, show a brief shimmer, then swap to a real screenshot. Confirm no more than ~2 generate at once (network tab: at most 2 in-flight `POST /api/pages/.../thumbnail`).

- [ ] **Step 3: Confirm files + DB rows exist**

Run: `ls public/uploads/thumbnails/`
Expected: one `<pageId>.png` per viewed page.

- [ ] **Step 4: Confirm freshness/staleness**

Reload the dashboard — cards paint instantly from cache with **no** regeneration (no new POSTs). Then edit a page in the editor, return to the dashboard — only that page regenerates.

- [ ] **Step 5: Confirm draft coverage + failure safety**

A never-published "Untitled Page" still gets a real preview. Temporarily stop the dev server mid-load (or rename the chromium binary) and confirm the dashboard still renders (cards keep gradient/last image; no crash). Restore.

- [ ] **Step 6: Confirm delete cleanup**

Delete a page from the dashboard, then `ls public/uploads/thumbnails/` — its PNG is gone.

---

## Self-Review

**Spec coverage:**

- Cached screenshot via Playwright → Tasks 7, 8. ✅
- Lazy regen on dashboard view → Tasks 9, 10 (client triggers stale cards). ✅
- Storage under `public/uploads` → Task 7 (`/uploads/thumbnails/<id>.png`). ✅
- Token-gated internal render route for drafts → Tasks 5, 6. ✅
- Staleness via content version (not the buggy `updatedAt`-on-self field) → Task 1 model + Task 2 predicate. ✅ (documented deviation)
- Client queue (max ~2) → Task 4 + used in Task 9. ✅
- Idempotent endpoint + per-page lock → Task 8 (staleness early-return) + Task 7 (`inFlight` map). ✅
- Never break the dashboard on failure → Task 8 (catch→500) + Task 9 (catch→keep image). ✅
- Cleanup on delete → Task 11. ✅
- Playwright binary install + env → Tasks 7.1, 12. ✅
- Tests: staleness, token, queue (unit) + card (dom) → Tasks 2, 3, 4, 9. ✅
- Gate = tsc + vitest, no `next build` → stated up top, used per task. ✅

**Placeholder scan:** none — `<generate: ...>` in Task 12 is an explicit instruction with the exact command, not a TODO.

**Type consistency:** `captureThumbnail` returns `ShotResult { url, takenForUpdatedAt: Date }` (Task 7), consumed in Task 8 as `.url` / `.takenForUpdatedAt.getTime()`. API returns `{ url, version }` (Task 8), consumed by `PageThumbnail` as `d.url` / `d.version` (Task 9). DTO sends `thumbnailUrl`/`thumbnailVersion`/`thumbnailStale` (Task 10), matching `PageThumbnail` props `initialUrl`/`version`/`stale` (Task 9) and the extended `PageItem` (Task 10). `isThumbnailStale(takenForUpdatedAt, pageUpdatedAt)` signature consistent across Tasks 2, 8, 10. `createLimiter(max)` → `limit(task)` consistent across Tasks 4, 9. ✅
