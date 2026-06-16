# 1. Next.js 16 App Router + React 19 as the application framework

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

Pagecraft is both a public-facing product (published pages at `/p/<slug>`,
CMS detail pages at `/c/<slug>/<item>`) and a rich, highly-interactive editor.
This implies two conflicting needs:

- **Public pages** must be server-rendered for SEO, fast first paint, and clean
  HTML with no client runtime cost.
- **The editor** is a heavy single-page application: drag-and-drop, undo/redo,
  live style editing, autosave.

We needed one framework that does server rendering, API routes, and a strong
client story without stitching together a separate backend.

## Decision

Use **Next.js 16 (App Router)** with **React 19** and **TypeScript** as a single
full-stack framework.

- Server Components / server pages handle auth, DB reads, metadata, and public
  page rendering.
- A small number of `"use client"` trees (notably the whole editor under
  `components/editor/`) own all interactivity.
- API route handlers under `app/api/` provide the backend; there is no separate
  server process.
- Route groups segment concerns: `(app)` for the authenticated studio, `(auth)`
  for login/signup, and public roots `p/` and `c/`.

## Consequences

- **Positive:** One deployable, one language end-to-end, shared types between
  server and client, built-in SSR/metadata for public pages, colocated API.
- **Positive:** The server/client boundary becomes a deliberate architectural
  seam — public render path stays lean; editor complexity is quarantined.
- **Negative:** Next 16 is recent and has breaking changes from prior versions
  (e.g. middleware renamed to `proxy` — see ADR 0008). Contributors must check
  current Next 16 behaviour rather than relying on older docs; this is called
  out in `AGENTS.md`.
- **Negative:** React 19 + Next 16 + Tailwind v4 are all on leading-edge
  versions, increasing the chance of ecosystem/tooling friction.

## Alternatives considered

- **Vite SPA + separate API server.** Rejected: no built-in SSR for public
  pages, two deployables, duplicated types and auth wiring.
- **Remix.** Viable, but the team favoured the App Router model and the Next
  ecosystem for metadata, image handling, and route conventions.
- **Astro for public pages + separate editor app.** Rejected: splits the data
  model and rendering pipeline across two stacks; the block renderer is shared
  between editor and public output and benefits from living in one project.
