# Client-side Page Thumbnails (modern-screenshot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace server-side Playwright/Chromium thumbnail capture with client-side capture inside the editor — render the page into a hidden off-screen 1280×800 iframe, snapshot it with `modern-screenshot`, and upload the PNG — removing the browser from the server entirely.

**Architecture:** A `ShotFrame` component is mounted (hidden) inside `EditorClient`'s provider tree, so it reads the same data the live `Canvas` does (tree/theme/colors/textStyles from zustand stores; components/collections/header/footer from React context). A module-level capture controller (`requestThumbnailCapture`) imperatively asks the mounted `ShotFrame` to render the page at a fixed 1280px desktop layout, waits for fonts/images, captures with `modern-screenshot`'s `domToBlob`, and POSTs the PNG to the repurposed `/api/pages/[id]/thumbnail` endpoint, which overwrites `/uploads/thumbnails/{id}.png` in place and upserts the `PageThumbnail` row. Triggers: publish, manual save, and once when a stale/missing page is opened.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19.2.4, zustand, axios (`@/lib/api/client`), Prisma, `modern-screenshot`, vitest.

## Global Constraints

- **Next.js 16.2.9 / React 19.2.4** — read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (per AGENTS.md). This plan adds no new Next APIs.
- **HTTP via axios only:** use `api` from `@/lib/api/client` and the endpoint registry `@/lib/api/endpoints`. Never hardcode endpoint URLs.
- **No justification/explanatory comments** on changes (user preference). Existing inline code comments may stay.
- **Output contract unchanged:** PNG written to `/uploads/thumbnails/{id}.png`; `PageThumbnail` model unchanged (`pageId`, `url`, `takenForUpdatedAt`); endpoint returns `{ url, version }` where `version = takenForUpdatedAt.getTime()`.
- **Gate before every commit:** `npx tsc --noEmit` && `npx vitest run` && `npm run lint` && `npm run format:check`. Do **NOT** run `next build` while `next dev` is running.
- **fallow gate before every commit (AGENTS.md):** run the cached binary
  `/Users/alexander/.npm/_npx/e6d07818f0a04ee4/node_modules/.bin/fallow audit --format json --quiet --explain --gate-marker agent`
  (re-find the hash with `find ~/.npm/_npx -maxdepth 3 -iname '*fallow*' -type d` if evicted). Only verdict `fail` blocks; `warn` is non-blocking. Do **not** `npm i`/`npx fallow` (the sandbox classifier denies it) — if the cache is gone, ask the user to run it via `! npx --yes fallow ...`.
- **Commit trailer:** every commit message ends with
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (shown in Task 1's commit step; keep it on all commits).
- **Work branch:** `feat/client-thumbnails-modern-screenshot` (already created; the design spec is committed there).

---

### Task 1: Add `modern-screenshot`, extract shared `copyStyles`

Installs the capture library and lifts the iframe stylesheet-cloning helper out of `CanvasFrame` into a shared module so `ShotFrame` (Task 5) can reuse it without duplication. No behavior change.

**Files:**
- Modify: `package.json` (add dependency)
- Create: `lib/editor/iframe-styles.ts`
- Modify: `components/editor/CanvasFrame.tsx:25-48` (remove local `copyStyles`, import shared)

**Interfaces:**
- Produces: `copyStyles(doc: Document): void` from `@/lib/editor/iframe-styles`

- [ ] **Step 1: Install modern-screenshot**

Run: `npm install modern-screenshot`
Expected: `package.json` `dependencies` gains `"modern-screenshot": "^4.x"`; install succeeds.

- [ ] **Step 2: Create the shared helper**

Create `lib/editor/iframe-styles.ts`:

```ts
export function copyStyles(doc: Document): void {
  document
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((n) => doc.head.appendChild(n.cloneNode(true)));

  const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] })
    .adoptedStyleSheets;
  if (adopted) {
    for (const sheet of adopted) {
      try {
        const text = Array.from(sheet.cssRules)
          .map((r) => r.cssText)
          .join("\n");
        if (text) {
          const el = doc.createElement("style");
          el.textContent = text;
          doc.head.appendChild(el);
        }
      } catch {
        /* inaccessible sheet — skip */
      }
    }
  }
}
```

- [ ] **Step 3: Use it in CanvasFrame**

In `components/editor/CanvasFrame.tsx`, delete the local `function copyStyles(doc: Document) { ... }` (lines 25-48) and add the import alongside the other imports:

```ts
import { copyStyles } from "@/lib/editor/iframe-styles";
```

Leave the `copyStyles(doc)` call inside `handleLoad` unchanged.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/editor/iframe-styles.ts components/editor/CanvasFrame.tsx
git commit -m "feat(thumbnails): add modern-screenshot; extract iframe copyStyles helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Capture controller (single-flight + throttle)

A framework-agnostic module that holds a reference to the mounted `ShotFrame`'s capturer and exposes a guarded `requestThumbnailCapture()`. Single-flight (overlapping requests share one capture) and throttle (rapid non-forced requests collapse). Triggers (Task 6) call this; `ShotFrame` (Task 5) registers the capturer.

**Files:**
- Create: `lib/thumbnails/capture-controller.ts`
- Test: `tests/thumbnail-capture-controller.test.ts`

**Interfaces:**
- Produces:
  - `type ThumbnailResult = { url: string; version: number }`
  - `registerThumbnailCapturer(fn: (() => Promise<ThumbnailResult | null>) | null): void`
  - `requestThumbnailCapture(opts?: { force?: boolean }): Promise<ThumbnailResult | null>`
  - `resetCaptureController(): void` (test-only reset of module state)

- [ ] **Step 1: Write the failing test**

Create `tests/thumbnail-capture-controller.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerThumbnailCapturer,
  requestThumbnailCapture,
  resetCaptureController,
} from "@/lib/thumbnails/capture-controller";

beforeEach(() => resetCaptureController());
afterEach(() => vi.useRealTimers());

describe("requestThumbnailCapture", () => {
  it("resolves null when no capturer is registered", async () => {
    expect(await requestThumbnailCapture({ force: true })).toBeNull();
  });

  it("is single-flight: overlapping calls share one capture", async () => {
    let resolveFn!: (r: { url: string; version: number }) => void;
    const capturer = vi.fn(
      () => new Promise<{ url: string; version: number }>((res) => (resolveFn = res)),
    );
    registerThumbnailCapturer(capturer);

    const a = requestThumbnailCapture({ force: true });
    const b = requestThumbnailCapture({ force: true });
    resolveFn({ url: "/u.png", version: 1 });

    expect(await a).toEqual({ url: "/u.png", version: 1 });
    expect(await b).toEqual({ url: "/u.png", version: 1 });
    expect(capturer).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid non-forced calls, then allows again after the window", async () => {
    vi.useFakeTimers();
    const capturer = vi.fn(async () => ({ url: "/u.png", version: 1 }));
    registerThumbnailCapturer(capturer);

    expect(await requestThumbnailCapture()).toEqual({ url: "/u.png", version: 1 });
    expect(await requestThumbnailCapture()).toBeNull(); // throttled
    vi.advanceTimersByTime(5000);
    expect(await requestThumbnailCapture()).toEqual({ url: "/u.png", version: 1 });
    expect(capturer).toHaveBeenCalledTimes(2);
  });

  it("swallows capturer errors and resolves null", async () => {
    registerThumbnailCapturer(async () => {
      throw new Error("boom");
    });
    expect(await requestThumbnailCapture({ force: true })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/thumbnail-capture-controller.test.ts`
Expected: FAIL — module `@/lib/thumbnails/capture-controller` not found.

- [ ] **Step 3: Implement the controller**

Create `lib/thumbnails/capture-controller.ts`:

```ts
export type ThumbnailResult = { url: string; version: number };
type Capturer = () => Promise<ThumbnailResult | null>;

const THROTTLE_MS = 4000;

let capturer: Capturer | null = null;
let inFlight: Promise<ThumbnailResult | null> | null = null;
let lastRun = 0;

export function registerThumbnailCapturer(fn: Capturer | null): void {
  capturer = fn;
}

export function requestThumbnailCapture(
  opts: { force?: boolean } = {},
): Promise<ThumbnailResult | null> {
  if (!capturer) return Promise.resolve(null);
  if (inFlight) return inFlight;
  const now = Date.now();
  if (!opts.force && now - lastRun < THROTTLE_MS) return Promise.resolve(null);
  lastRun = now;
  const run = capturer;
  inFlight = run()
    .catch((e) => {
      console.error("[thumbnail] client capture failed", e);
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function resetCaptureController(): void {
  capturer = null;
  inFlight = null;
  lastRun = 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/thumbnail-capture-controller.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/thumbnails/capture-controller.ts tests/thumbnail-capture-controller.test.ts
git commit -m "feat(thumbnails): client capture controller (single-flight + throttle)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Thumbnail upload client function

Posts the captured PNG blob to the thumbnail endpoint via the axios client + endpoint registry.

**Files:**
- Create: `lib/thumbnails/upload-thumbnail.ts`
- Test: `tests/upload-thumbnail.test.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/api/client`), `endpoints.pages.thumbnail(id)` (`@/lib/api/endpoints`)
- Produces: `uploadThumbnail(pageId: string, blob: Blob): Promise<{ url: string; version: number } | null>`

- [ ] **Step 1: Write the failing test**

Create `tests/upload-thumbnail.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/api/client", () => ({
  api: { post: vi.fn() },
}));

import { api } from "@/lib/api/client";
import { uploadThumbnail } from "@/lib/thumbnails/upload-thumbnail";

const post = api.post as unknown as Mock;

describe("uploadThumbnail", () => {
  beforeEach(() => post.mockReset());

  it("posts FormData with the file to the page thumbnail endpoint and returns data", async () => {
    post.mockResolvedValueOnce({ data: { url: "/uploads/thumbnails/p1.png", version: 42 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    const res = await uploadThumbnail("p1", blob);

    expect(res).toEqual({ url: "/uploads/thumbnails/p1.png", version: 42 });
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/api/pages/p1/thumbnail");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("returns null when the request throws", async () => {
    post.mockRejectedValueOnce(new Error("network"));
    const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
    expect(await uploadThumbnail("p1", blob)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/upload-thumbnail.test.ts`
Expected: FAIL — module `@/lib/thumbnails/upload-thumbnail` not found.

- [ ] **Step 3: Implement**

Create `lib/thumbnails/upload-thumbnail.ts`:

```ts
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export async function uploadThumbnail(
  pageId: string,
  blob: Blob,
): Promise<{ url: string; version: number } | null> {
  const fd = new FormData();
  fd.append("file", blob, `${pageId}.png`);
  try {
    const { data } = await api.post<{ url: string; version: number }>(
      endpoints.pages.thumbnail(pageId),
      fd,
    );
    return data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/upload-thumbnail.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/thumbnails/upload-thumbnail.ts tests/upload-thumbnail.test.ts
git commit -m "feat(thumbnails): client uploadThumbnail helper"
```
(Append the standard Co-Authored-By trailer to every commit, as in Task 1.)

---

### Task 4: Repurpose the thumbnail endpoint to RECEIVE a PNG

Rewrite `POST /api/pages/[id]/thumbnail` so it stores an uploaded PNG (overwriting `/uploads/thumbnails/{id}.png`) and upserts `PageThumbnail` — no Playwright. Keeps `withSiteRole("EDITOR")` ownership check and adds basic rate-limiting like `/api/upload`.

**Files:**
- Modify (rewrite): `app/api/pages/[id]/thumbnail/route.ts`
- Test: `tests/pages-thumbnail-route.test.ts`

**Interfaces:**
- Consumes: `withSiteRole` (`@/lib/api/api-handler`), `json`/`notFound`/`badRequest`/`error` (`@/lib/api/api-response`), `enforce` (`@/lib/rate-limit`), `prisma` (`@/lib/prisma`)
- Produces: `POST` returning `{ url, version }` (200), `404` if page not owned, `400` if no file, `413` if too large

- [ ] **Step 1: Write the failing test**

Create `tests/pages-thumbnail-route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  siteId: "site1",
  page: null as null | { id: string; updatedAt: Date },
  written: [] as string[],
  upserts: [] as unknown[],
}));

vi.mock("@/lib/api/api-handler", () => ({
  withSiteRole: (_min: string, fn: (c: { site: { id: string } }) => unknown) =>
    fn({ site: { id: state.siteId } }),
}));
vi.mock("@/lib/rate-limit", () => ({ enforce: () => null }));
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (p: string) => {
    state.written.push(p);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    page: { findFirst: vi.fn(async () => state.page) },
    pageThumbnail: {
      upsert: vi.fn(async (args: unknown) => {
        state.upserts.push(args);
      }),
    },
  },
}));

import { POST } from "@/app/api/pages/[id]/thumbnail/route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function reqWithFile() {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "p1.png");
  return new Request("http://localhost/api/pages/p1/thumbnail", { method: "POST", body: fd });
}

describe("POST /api/pages/[id]/thumbnail", () => {
  beforeEach(() => {
    state.written = [];
    state.upserts = [];
  });

  it("404 when the page is not found for this site", async () => {
    state.page = null;
    const res = await POST(reqWithFile(), ctx("p1"));
    expect(res.status).toBe(404);
  });

  it("400 when no file is provided", async () => {
    state.page = { id: "p1", updatedAt: new Date(1000) };
    const res = await POST(
      new Request("http://localhost/api/pages/p1/thumbnail", { method: "POST", body: new FormData() }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
  });

  it("writes the PNG, upserts, and returns { url, version }", async () => {
    state.page = { id: "p1", updatedAt: new Date(1000) };
    const res = await POST(reqWithFile(), ctx("p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; version: number };
    expect(body).toEqual({ url: "/uploads/thumbnails/p1.png", version: 1000 });
    expect(state.written.some((p) => p.endsWith("p1.png"))).toBe(true);
    expect(state.upserts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pages-thumbnail-route.test.ts`
Expected: FAIL — current route imports `captureThumbnail` and expects no file; assertions on `{url, version}`/writeFile fail.

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `app/api/pages/[id]/thumbnail/route.ts` with:

```ts
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json, notFound, badRequest, error } from "@/lib/api/api-response";
import { enforce } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const THUMB_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
const MAX_BYTES = 8 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const limited = enforce(req, "thumbnail", 30, 60_000);
  if (limited) return limited;

  return withSiteRole("EDITOR", async (ctx) => {
    const { id } = await params;
    const page = await prisma.page.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!page) return notFound();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return badRequest("No file provided");
    if (file.size > MAX_BYTES) return error(413, "Thumbnail too large");

    await mkdir(THUMB_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(THUMB_DIR, `${id}.png`), buffer);

    const url = `/uploads/thumbnails/${id}.png`;
    const takenForUpdatedAt = page.updatedAt;
    await prisma.pageThumbnail.upsert({
      where: { pageId: id },
      create: { pageId: id, url, takenForUpdatedAt },
      update: { url, takenForUpdatedAt },
    });

    return json({ url, version: takenForUpdatedAt.getTime() });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pages-thumbnail-route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS. (The route no longer imports `@/lib/thumbnails/screenshot`; those files still exist and are deleted in Task 9.)

```bash
git add app/api/pages/[id]/thumbnail/route.ts tests/pages-thumbnail-route.test.ts
git commit -m "feat(thumbnails): thumbnail endpoint receives + stores uploaded PNG"
```

---

### Task 5: `ShotFrame` — off-screen 1280×800 capture component

A hidden iframe mounted inside the editor providers. It always keeps an empty, style-synced iframe loaded; when a capture is requested it portals the page (header + tree + footer, `animate` off, `inlineStyles={false}`) into the iframe body, waits for fonts + images, captures with `domToBlob`, uploads, and clears. Registers/unregisters its capturer with the controller.

**Files:**
- Create: `components/editor/ShotFrame.tsx`

**Interfaces:**
- Consumes: `copyStyles` (Task 1), `registerThumbnailCapturer`/`ThumbnailResult` (Task 2), `uploadThumbnail` (Task 3), `BlockRenderer` (`@/components/BlockRenderer`), `responsiveCss` (`@/lib/blocks/styles`), `designSystemCss` (`@/lib/design/design-system`), `themeVars` (`@/lib/design/theme`), stores `useEditor`/`useDesignSystem`, contexts `useComponents`/`useCollections`/`useSite`
- Produces: `<ShotFrame />` (no props); registers a capturer that returns `Promise<ThumbnailResult | null>`

- [ ] **Step 1: Create the component**

Create `components/editor/ShotFrame.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { domToBlob } from "modern-screenshot";
import { responsiveCss } from "@/lib/blocks/styles";
import { designSystemCss } from "@/lib/design/design-system";
import { themeVars } from "@/lib/design/theme";
import { copyStyles } from "@/lib/editor/iframe-styles";
import { BlockRenderer } from "@/components/BlockRenderer";
import { useEditor } from "@/store/editor-store";
import { useDesignSystem } from "@/store/design-system";
import {
  registerThumbnailCapturer,
  type ThumbnailResult,
} from "@/lib/thumbnails/capture-controller";
import { uploadThumbnail } from "@/lib/thumbnails/upload-thumbnail";
import { useComponents } from "./components-context";
import { useCollections } from "./collections-context";
import { useSite } from "./site-context";

const WIDTH = 1280;
const HEIGHT = 800;

function raf(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

async function settleImages(doc: Document, timeoutMs: number): Promise<void> {
  const imgs = Array.from(doc.images);
  await Promise.race([
    Promise.all(imgs.map((img) => img.decode().catch(() => undefined))),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
}

export function ShotFrame() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const dynRef = useRef<HTMLStyleElement | null>(null);
  const [capturing, setCapturing] = useState(false);
  const resolveRef = useRef<((r: ThumbnailResult | null) => void) | null>(null);

  const tree = useEditor((s) => s.tree);
  const theme = useEditor((s) => s.theme);
  const colors = useDesignSystem((s) => s.colors);
  const textStyles = useDesignSystem((s) => s.textStyles);
  const components = useComponents();
  const collections = useCollections();
  const site = useSite();

  const handleLoad = () => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    copyStyles(doc);
    const dyn = doc.createElement("style");
    dyn.setAttribute("data-pc-shot", "");
    doc.head.appendChild(dyn);
    dynRef.current = dyn;
    doc.documentElement.style.height = "100%";
    doc.body.style.margin = "0";
    doc.body.style.minHeight = "100%";
    doc.body.style.background = "#ffffff";
    setBody(doc.body);
  };

  useEffect(() => {
    if (!body || !dynRef.current) return;
    dynRef.current.textContent =
      designSystemCss(colors, textStyles) +
      "\n" +
      responsiveCss([...tree, ...site.header, ...site.footer], { editable: false });
    const vars = themeVars(theme) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) body.style.setProperty(k, v);
  }, [body, tree, site.header, site.footer, colors, textStyles, theme]);

  useEffect(() => {
    const capture = (): Promise<ThumbnailResult | null> =>
      new Promise((resolve) => {
        if (!useEditor.getState().pageId || !ref.current?.contentDocument?.body) {
          resolve(null);
          return;
        }
        resolveRef.current = resolve;
        setCapturing(true);
      });
    registerThumbnailCapturer(capture);
    return () => registerThumbnailCapturer(null);
  }, []);

  useEffect(() => {
    if (!capturing || !body) return;
    let cancelled = false;
    const finish = (r: ThumbnailResult | null) => {
      if (cancelled) return;
      resolveRef.current?.(r);
      resolveRef.current = null;
      setCapturing(false);
    };
    void (async () => {
      const doc = body.ownerDocument;
      const pageId = useEditor.getState().pageId;
      if (!pageId) return finish(null);
      try {
        await doc.fonts?.ready;
        await settleImages(doc, 4000);
        await raf();
        await raf();
        if (cancelled) return;
        const blob = await domToBlob(body, {
          width: WIDTH,
          height: HEIGHT,
          scale: 1,
          backgroundColor: "#ffffff",
          type: "image/png",
          timeout: 8000,
          features: { restoreScrollPosition: true },
        });
        if (cancelled || !blob) return finish(null);
        finish(await uploadThumbnail(pageId, blob));
      } catch (e) {
        console.error("[thumbnail] shot failed", e);
        finish(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capturing, body]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -99999,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <iframe
        ref={ref}
        title="thumbnail"
        srcDoc="<!doctype html><html><head></head><body></body></html>"
        onLoad={handleLoad}
        style={{ width: WIDTH, height: HEIGHT, border: 0, background: "#fff" }}
      />
      {body &&
        capturing &&
        createPortal(
          <>
            {site.header.length > 0 && (
              <BlockRenderer
                tree={site.header}
                viewport="desktop"
                inlineStyles={false}
                components={components.map}
                collections={collections.map}
              />
            )}
            <BlockRenderer
              tree={tree}
              viewport="desktop"
              inlineStyles={false}
              components={components.map}
              collections={collections.map}
            />
            {site.footer.length > 0 && (
              <BlockRenderer
                tree={site.footer}
                viewport="desktop"
                inlineStyles={false}
                components={components.map}
                collections={collections.map}
              />
            )}
          </>,
          body,
        )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (`BlockRenderer`'s `animate` defaults to `false`, so omitting it captures the final frame.)

- [ ] **Step 3: Commit**

```bash
git add components/editor/ShotFrame.tsx
git commit -m "feat(thumbnails): ShotFrame off-screen 1280x800 capture component"
```

---

### Task 6: Wire triggers — mount ShotFrame, capture on publish / manual save / open-if-stale

Mounts `<ShotFrame />` in `EditorClient`, routes the manual Save action through a wrapper that captures, captures after a successful publish, and fires a one-shot capture when a stale/missing page is opened. Threads `thumbnailStale` from the edit-page server component into `PageDTO`.

**Files:**
- Modify: `components/editor/use-editor-persistence.ts` (publish capture + `saveManual`)
- Modify: `components/editor/EditorClient.tsx` (mount ShotFrame; wire `saveManual`; open-if-stale effect; `PageDTO.thumbnailStale`)
- Modify: `app/editor/[id]/page.tsx` (include thumbnail, compute + pass `thumbnailStale`)

**Interfaces:**
- Consumes: `requestThumbnailCapture` (Task 2), `<ShotFrame />` (Task 5), `isThumbnailStale` (`@/lib/thumbnails/staleness`)
- Produces: `useEditorPersistence(...)` now also returns `saveManual: () => Promise<void>`

- [ ] **Step 1: Add capture to publish + a `saveManual` wrapper**

In `components/editor/use-editor-persistence.ts`:

Add the import near the other `@/lib/...` imports:

```ts
import { requestThumbnailCapture } from "@/lib/thumbnails/capture-controller";
```

In `publish`, after the versions POST line, add the forced capture (inside the `try`):

```ts
      void api.post(endpoints.pages.versions(s.pageId), { label: "Published" }).catch(() => {});
      void requestThumbnailCapture({ force: true });
```

After the `publish` callback, add:

```ts
  const saveManual = useCallback(async () => {
    await save();
    void requestThumbnailCapture();
  }, [save]);
```

Add `saveManual` to the returned object:

```ts
  return { save, saveManual, publish, unpublish, exportHtml, exportRef };
```

- [ ] **Step 2: Thread `thumbnailStale` through PageDTO and the server page**

In `components/editor/EditorClient.tsx`, extend `PageDTO`:

```ts
export type PageDTO = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  content: Block[];
  seo?: Seo;
  theme?: Theme;
  thumbnailStale?: boolean;
};
```

In `app/editor/[id]/page.tsx`, add the import:

```ts
import { isThumbnailStale } from "@/lib/thumbnails/staleness";
```

Change the page query to include the thumbnail:

```ts
  const page = await prisma.page.findFirst({
    where: { id, siteId: ctx.site.id },
    include: { thumbnail: true },
  });
```

Add `thumbnailStale` to the `page` object passed to `<EditorClient>` (alongside `theme`):

```ts
        theme,
        thumbnailStale: isThumbnailStale(page.thumbnail?.takenForUpdatedAt, page.updatedAt),
```

- [ ] **Step 3: Mount ShotFrame, wire saveManual, add open-if-stale effect**

In `components/editor/EditorClient.tsx`:

Change the React import to include `useEffect`:

```ts
import { useEffect, useRef } from "react";
```

Add imports:

```ts
import { ShotFrame } from "./ShotFrame";
import { requestThumbnailCapture } from "@/lib/thumbnails/capture-controller";
```

Pull `saveManual` out of persistence:

```ts
  const { save, saveManual, publish, unpublish, exportHtml, exportRef } = persistence;
```

Wire the manual Save entry points to `saveManual`:
- `<TopBar ... onSave={saveManual} ... />` (was `onSave={save}`)
- `<CommandPalette ... onSave={saveManual} ... />` (was `onSave={save}`)

Leave `UnsavedModal` and `VersionHistory` on `save` (navigation/restore saves don't trigger a capture).

Add the open-if-stale effect after the `useEditorClientState` destructure (before the `if (!ready)` early return):

```ts
  useEffect(() => {
    if (mode !== "page" || !ready || !page.thumbnailStale) return;
    const t = setTimeout(() => void requestThumbnailCapture({ force: true }), 1500);
    return () => clearTimeout(t);
  }, [mode, ready, page.thumbnailStale]);
```

Mount `<ShotFrame />` inside the provider tree — add it right after the hidden export `<div ref={exportRef}>…</div>` block (still inside `<DragProvider>`):

```tsx
                {/* hidden clean render used by HTML export */}
                <div ref={exportRef} className="hidden" aria-hidden>
                  <BlockRenderer
                    tree={tree}
                    viewport="desktop"
                    inlineStyles={false}
                    components={componentsMap}
                    collections={collectionsMap}
                  />
                </div>

                {mode === "page" && <ShotFrame />}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. Confirm no `react-hooks` violations on the new effect (deps: `mode`, `ready`, `page.thumbnailStale`).

- [ ] **Step 5: Commit**

```bash
git add components/editor/use-editor-persistence.ts components/editor/EditorClient.tsx app/editor/[id]/page.tsx
git commit -m "feat(thumbnails): capture on publish, manual save, and open-if-stale"
```

---

### Task 7: Dashboard stops generating; display-only thumbnails

The dashboard no longer POSTs to regenerate (no server browser). `PageThumbnail` becomes display-only (stored image if present, placeholder otherwise — decision A).

**Files:**
- Modify (simplify): `components/dashboard/PageThumbnail.tsx`
- Modify: `components/dashboard/PageCard.tsx:94-100` (drop `pageId`/`stale` props)

**Interfaces:**
- Produces: `<PageThumbnail title={string} initialUrl={string|null} version={number|null} />`

- [ ] **Step 1: Simplify PageThumbnail**

Replace the entire contents of `components/dashboard/PageThumbnail.tsx` with:

```tsx
import { FileText } from "lucide-react";

export function PageThumbnail({
  title,
  initialUrl,
  version,
}: {
  title: string;
  initialUrl: string | null;
  version: number | null;
}) {
  const src = initialUrl ? `${initialUrl}?v=${version ?? 0}` : null;

  return (
    <div className="absolute inset-0 bg-[#fbfbfc]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#cdd2d8]">
          <FileText size={22} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
```

(This drops the `"use client"` directive, the `useState`/`useEffect`/`useRef` capture logic, and the `createLimiter`/`api`/`endpoints` imports. `createLimiter` is now unreferenced and is deleted in Task 9.)

- [ ] **Step 2: Update PageCard's usage**

In `components/dashboard/PageCard.tsx`, change the `<PageThumbnail>` invocation to:

```tsx
        <PageThumbnail
          title={page.title}
          initialUrl={page.thumbnailUrl}
          version={page.thumbnailVersion}
        />
```

Leave the `DashboardPage` type and the dashboard server DTO (`app/(app)/page.tsx`) unchanged — `thumbnailStale` stays computed server-side (cheap; harmless if unused on the card).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. No unused-var errors in `PageThumbnail`/`PageCard`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/PageThumbnail.tsx components/dashboard/PageCard.tsx
git commit -m "feat(thumbnails): dashboard thumbnails are display-only (no server regen)"
```

---

### Task 8: Manual verification in the running app

`modern-screenshot` rendering can't be meaningfully unit-tested (jsdom doesn't lay out/paint), so verify fidelity against the real app. **Do not run `next build`** — use the dev server only.

**Files:** none (verification)

- [ ] **Step 1: Start the dev server (if not already running)**

Run: `npm run dev`
Open: `http://localhost:3000`

- [ ] **Step 2: Verify capture-on-publish**

Open a page in the editor (`/editor/<id>`), make an edit, click **Publish**. Then:

Run: `ls -la public/uploads/thumbnails/<id>.png`
Expected: file mtime is "just now" (freshly written). Open it — it should show the page's desktop (1280×800, top-aligned) render with correct fonts, colors, header/footer.

- [ ] **Step 3: Verify capture-on-manual-save**

Make another edit, click **Save** (not autosave). Confirm `<id>.png` mtime updates again.

- [ ] **Step 4: Verify open-if-stale**

In a DB tool (or `npx prisma studio`), delete the `PageThumbnail` row for a page (or set its `takenForUpdatedAt` older than `Page.updatedAt`). Reload `/editor/<id>`, wait ~2s, confirm `<id>.png` is regenerated and the dashboard card shows it.

- [ ] **Step 5: Verify the dashboard**

Go to `/` (dashboard). Confirm cards show stored thumbnails; a page with no thumbnail shows the `FileText` placeholder; no failed network POSTs to `/api/pages/*/thumbnail` fire from the dashboard (check DevTools Network).

- [ ] **Step 6: Fidelity edge check (expected, not a bug)**

On a page containing an external (cross-origin, non-CORS) image and/or an Embed/Code block with a third-party `<iframe>`, confirm the rest of the page captures fine and those specific elements may be blank — this is the accepted limitation from the spec. If the **whole** capture is blank, switch the `domToBlob` target in `ShotFrame.tsx` from `body` to `body.ownerDocument.documentElement` and re-verify.

- [ ] **Step 7: Record the result**

If all pass, note it in the task tracker and proceed. If a step fails, stop and debug before Task 9 (do not delete the Playwright path until client capture is confirmed working).

---

### Task 9: Remove the Playwright path

With client capture confirmed (Task 8), delete the dead server-browser code and the dependency. Run `fallow dead-code --trace` first per AGENTS.md.

**Files:**
- Delete: `lib/thumbnails/screenshot.ts`, `lib/thumbnails/token.ts`, `lib/thumbnails/queue.ts`
- Delete: `app/internal/shot/[id]/page.tsx` (and the now-empty `app/internal/shot/[id]` / `app/internal/shot` / `app/internal` dirs if empty)
- Modify: `package.json` (remove `playwright` from `devDependencies`)
- Keep: `lib/thumbnails/staleness.ts`, `components/PageDocument.tsx` (PageDocument is still used by the public page render)

- [ ] **Step 1: Confirm the files are unreferenced**

Run:
```bash
grep -rn "thumbnails/screenshot\|thumbnails/token\|thumbnails/queue\|internal/shot\|captureThumbnail\|createLimiter\|signShotToken\|verifyShotToken" app/ components/ lib/ tests/
```
Expected: no matches (all consumers removed in Tasks 4–7). If any remain, fix them before deleting.

Run the fallow dead-code trace as the AGENTS task map prescribes (informational):
```bash
BIN=/Users/alexander/.npm/_npx/e6d07818f0a04ee4/node_modules/.bin/fallow
"$BIN" dead-code --trace lib/thumbnails/screenshot.ts:captureThumbnail
```
Expected: confirms `captureThumbnail` has no remaining callers.

- [ ] **Step 2: Delete the files**

Run:
```bash
git rm lib/thumbnails/screenshot.ts lib/thumbnails/token.ts lib/thumbnails/queue.ts app/internal/shot/[id]/page.tsx
```
Then remove any now-empty `app/internal/...` directories.

- [ ] **Step 3: Remove the playwright devDependency**

Edit `package.json` to delete the `"playwright": "^1.60.0"` line from `devDependencies`, then:

Run: `npm install`
Expected: `package-lock.json` updates; `node_modules/playwright` removed.

- [ ] **Step 4: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run format:check`
Expected: ALL PASS. No import resolves to a deleted file.

- [ ] **Step 5: fallow audit + commit**

Run the fallow audit gate (Global Constraints). Expected verdict `warn` or `pass` (not `fail`).

```bash
git add -A
git commit -m "chore(thumbnails): remove Playwright/Chromium capture path

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| Client-side capture with modern-screenshot | T1 (dep), T5 (ShotFrame `domToBlob`) |
| Off-screen 1280×800 desktop iframe, preview, animate off | T5 |
| Reuse canvas render pipeline (copyStyles + design/responsive CSS) | T1 (copyStyles), T5 |
| Triggers: publish + manual save + open-if-stale | T6 |
| Repurposed endpoint receives PNG, overwrites in place, upserts | T4 |
| Not routed through /api/upload (no asset pollution) | T4 (dedicated route) |
| Dashboard display-only, placeholder when none (decision A) | T7 |
| Remove screenshot.ts/token.ts/queue.ts/internal-shot + playwright dep | T9 |
| Keep staleness.ts | T6/T9 (kept) |
| Error handling: failures swallowed, never block publish/save | T2 (controller catch), T3 (upload catch), T5 (try/catch) |
| Cross-origin image / third-party iframe limits | T8 Step 6 (verified, accepted) |
| Testing: controller, endpoint, upload unit-tested; capture manual | T2, T3, T4 (unit), T8 (manual) |
| Gate tsc+vitest+lint+format; no next build during dev | Global Constraints, every task |

No gaps.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step shows full code; every test step shows the full test.

**3. Type consistency:** `ThumbnailResult = { url: string; version: number }` is defined in T2 and consumed verbatim in T5. `registerThumbnailCapturer`/`requestThumbnailCapture` signatures match across T2/T5/T6. `uploadThumbnail(pageId, blob)` defined T3, called T5. Endpoint returns `{ url, version }` (T4) matching `uploadThumbnail`'s generic and the controller result. `PageThumbnail` props `{ title, initialUrl, version }` defined T7 and called identically in PageCard. `saveManual` added to the persistence return (T6 Step 1) and destructured (T6 Step 3).

**4. Ambiguity check:** "manual save" = the TopBar/CommandPalette Save action wired to `saveManual`; autosave keeps calling `save()` (no capture) — made explicit in T6. `BlockRenderer.animate` defaults to `false`, so the shot captures the final frame (noted in T5 Step 2). Open-if-stale uses a fixed 1500ms settle after `ready` (T6) — a documented timing trade-off; it self-heals on the next publish/save if the first auto-capture races data loading.
