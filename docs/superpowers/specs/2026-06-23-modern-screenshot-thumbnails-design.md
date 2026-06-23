# Client-side page thumbnails with modern-screenshot

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation plan
**Replaces:** Server-side Playwright/Chromium thumbnail capture

## Problem

Page thumbnails are currently produced by launching **Playwright Chromium** server-side: a
signed-token request navigates a headless browser to `/internal/shot/[id]`, waits for fonts, and
screenshots the rendered `PageDocument` at 1280×800. This is heavy in two ways that hurt our
self-hosted deployment (Oracle Free VM + Docker: Caddy + app + Postgres):

- **Install/image size** — `playwright install` pulls Chromium *and* Firefox + WebKit even though
  we only use Chromium.
- **Runtime RAM** — a Chromium instance is ~150–300 MB resident, competing with Postgres and the
  app on a small VM.

It also forces an on-demand server-render path: the dashboard lazily POSTs to the thumbnail route
to regenerate stale thumbnails, which only works because a browser is available on the server.

## Goal

Remove the server browser entirely. Generate thumbnails **client-side** with
[`modern-screenshot`](https://github.com/qq15725/modern-screenshot) (the maintained fork of
`html-to-image`), capturing the page DOM in the user's browser and uploading the resulting PNG.

### Non-goals

- Pixel-perfect capture of cross-origin images or third-party `<iframe>` embeds (browsers cannot
  snapshot opaque cross-origin content; we accept graceful degradation).
- Regenerating a thumbnail for a page that no one currently has open (no server browser exists to
  do this; covered instead by the "open-if-stale" trigger as users browse their pages).
- Changing the dashboard `PageThumbnail`/`PageCard` visuals or the `PageThumbnail` data model.

## Why not the alternatives (for the record)

- **Satori + resvg** — lightest, but renders only a CSS subset with no JS; cannot faithfully render
  arbitrary user-built pages. Good for OG templates we control, wrong for a page builder.
- **Lighter server browser** (`puppeteer-core` + `chrome-headless-shell` / `@sparticuz/chromium`) —
  keeps a browser on the VM, which is exactly what we want to eliminate.
- **Hosted screenshot API** — robust but costs money per shot or moves Chromium into a sidecar
  container; still server infrastructure.

Client-side capture removes the browser from our infrastructure entirely and reuses the editor's
existing same-origin iframe render pipeline.

## Key facts the design relies on

- The editor renders the page in a **same-origin iframe** (`srcDoc` in
  `components/editor/CanvasFrame.tsx`), so client JS can reach `iframe.contentDocument` and capture
  its DOM. Editor overlays/handles live *outside* the iframe and are therefore never captured.
- The iframe render pipeline already copies `<style>`/`<link>` (fonts via `next/font`) from the host
  document and injects design-system + responsive CSS. We can `await
  iframe.contentDocument.fonts.ready` before capturing — the same wait Playwright performs.
- Storage today: PNG at `/uploads/thumbnails/{id}.png` + a `PageThumbnail` row
  (`pageId`, `url`, `takenForUpdatedAt`). The dashboard reads `thumbnailUrl` / `thumbnailVersion` /
  `thumbnailStale` and cache-busts with `?v={version}`.
- `/internal/shot/[id]` exists **only** for Playwright to navigate to.
- All capture triggers happen *inside the editor*, where the full page data (tree, theme, header /
  footer, design system, component map) is already client-side.

## Decisions (from brainstorming)

1. **Regeneration model:** capture on **publish** + on **manual save** (not autosave) + once when a
   **stale/missing page is opened** in the editor (self-heals old pages as users browse).
2. **Capture source:** a **throwaway off-screen iframe at a fixed 1280×800 desktop layout**
   (preview mode, animations off, scrolled to top) — deterministic, independent of the editor's
   current device/zoom/scroll state.
3. **Dashboard fallback:** show the stored thumbnail if one exists (even if stale); only show a
   placeholder when there is truly none. The dashboard no longer triggers regeneration.

## Architecture

```
Editor trigger (publish / manual-save / open-if-stale)
   └─> capturePageThumbnail(editorState)        [single-flight + throttle guard]
         1. mount hidden <iframe> 1280×800, preview mode, desktop bp, animate=false, scroll top
         2. copy styles + inject design-system/responsive CSS (reuse CanvasFrame pipeline)
         3. await contentDocument.fonts.ready ; settle images (img.decode() w/ timeout)
         4. modern-screenshot domToBlob(iframe.body, { width:1280, height:800, type:'image/png' })
         5. POST blob (multipart `file`) -> /api/pages/[id]/thumbnail
         6. destroy iframe (finally)
   <- { url, version }   (nothing else to do; dashboard reads on next visit)
```

## Components

### `components/editor/ShotFrame.tsx`

A hidden iframe (`position:fixed; left:-99999px; top:0; width:1280px; height:800px`) that reuses the
**same render path as the live canvas** — `copyStyles`, design-system + responsive CSS injection,
and `BlockRenderer` over `header + tree + footer` — but forced to:

- desktop breakpoint,
- `previewMode = true`,
- `animate = false`,
- scrolled to top.

Rationale for an iframe over an off-screen `<div>`: responsive CSS uses media queries and viewport
units that must resolve against a real 1280px viewport — the same reason the live canvas uses an
iframe.

### `lib/thumbnails/capture-client.ts`

- `capturePageThumbnail(args): Promise<{ url: string; version: number } | null>`
- Mounts `ShotFrame`, `await iframe.contentDocument.fonts.ready`, settles images via
  `Promise.all(images.map(i => i.decode()))` bounded by a timeout, then calls `modern-screenshot`
  `domToBlob(body, { width: 1280, height: 800, type: 'image/png' })`.
- Tears the iframe down in a `finally`.
- **Single-flight + throttle guard:** never run two captures for the same page concurrently;
  collapse rapid triggers (e.g. save bursts) into one capture.
- Swallows errors (logs, returns `null`); never throws into publish/save.

### Triggers — wiring

- **Publish** — `components/editor/use-editor-persistence.ts`: after `publish()` succeeds (it already
  `save()`s first), fire-and-forget `capturePageThumbnail()`.
- **Manual save** — hook the explicit Save action only (not autosave), throttled.
- **Open-if-stale** — `components/editor/EditorClient.tsx`: after first render + `fonts.ready`, if the
  page's thumbnail is missing or stale (`isThumbnailStale`), fire one background capture.

### Storage endpoint — `POST /api/pages/[id]/thumbnail` (repurposed)

- Now **receives** the uploaded PNG (multipart `file`) instead of running Playwright.
- Authorizes that the caller owns the page (existing site/workspace guard).
- Writes the bytes to `/uploads/thumbnails/{id}.png` (**overwrite in place** — no storage growth, no
  asset-library pollution).
- Upserts `PageThumbnail { url, takenForUpdatedAt: page.updatedAt }`.
- Returns `{ url, version }` (`version = takenForUpdatedAt.getTime()`), preserving the existing
  client contract.
- **Not** routed through `/api/upload` — thumbnails must not land in the user's media library.

## Data flow & model

- `PageThumbnail` model unchanged.
- Dashboard fields (`thumbnailUrl`, `thumbnailVersion`, `thumbnailStale`) unchanged; `PageCard` and
  `PageThumbnail.tsx` keep rendering as-is.
- `PageThumbnail.tsx` change: **remove** the client-side "POST to regenerate when stale" call. The
  dashboard now only displays; it never generates.

## Removal (Playwright)

Delete:

- `lib/thumbnails/screenshot.ts` (Playwright capture)
- `lib/thumbnails/token.ts` (shot-route HMAC token; only needed by the internal route)
- `lib/thumbnails/queue.ts` (server concurrency limiter for Playwright)
- `app/internal/shot/[id]` route (only consumer was Playwright)
- `playwright` from `devDependencies`

Keep:

- `lib/thumbnails/staleness.ts` (`isThumbnailStale`) — still used by the open-if-stale trigger and
  the dashboard stale flag.

Add:

- `modern-screenshot` to `dependencies`.

## Error handling & known fidelity limits

- **Cross-origin images** without CORS headers can't be inlined → blank in the thumbnail, but
  capture still succeeds. Same-origin `/uploads` images are fine.
- **Third-party `<iframe>` embeds** (Embed/Code blocks) render blank — cross-origin frame content is
  opaque to capture. Accepted.
- **Capture/upload failure** → log + keep the previous thumbnail; never surfaces an error or blocks
  publish/save.
- **Fonts** — gated on `iframe.contentDocument.fonts.ready`; `modern-screenshot` inlines reachable
  webfonts.

## Testing

- Unit (vitest, already configured):
  - throttle / single-flight guard behavior,
  - `isThumbnailStale` decision used by the open-if-stale trigger,
  - thumbnail endpoint: auth rejection, happy-path write + `PageThumbnail` upsert, returns
    `{ url, version }`.
- The DOM capture itself can't be meaningfully unit-tested (jsdom doesn't lay out/paint); it gets a
  thin seam and is **manually verified** by capturing a real page in the running app and inspecting
  fidelity.
- Gate (per project rules): `tsc` + `vitest` + `npm run lint` + `format:check`. Do **not** run
  `next build` while `next dev` is live.

## Rollout notes

- Existing `/uploads/thumbnails/{id}.png` files remain valid and are overwritten in place on next
  capture.
- Pages not yet re-captured keep their existing (possibly stale) thumbnail per dashboard rule A;
  opening or republishing refreshes them client-side.
- No data migration required (`PageThumbnail` schema unchanged).
