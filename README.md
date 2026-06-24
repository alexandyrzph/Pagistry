# Pagistry — Visual Page Builder
[<img width="1512" height="762" alt="Screenshot 2026-06-24 at 20 08 41" src="https://github.com/user-attachments/assets/093d30dc-a8b1-456f-a0a5-2eaccd7a7b13" />](https://app.pagistry.com/)

A clean, full-stack drag-and-drop page builder (Divi-style) built with **Next.js
16, React 19, TypeScript, Tailwind CSS v4, Prisma + PostgreSQL, dnd-kit and Zustand**.

Build pages from a rich library of blocks, fine-tune content and style per
breakpoint, preview responsively, then **publish to a public URL** or **export
standalone HTML**.

## Features

- **Drag-and-drop canvas** with live insertion indicators and inline text editing
- **20+ blocks** across three categories:
  - **Layout** — Section, Columns (1–4 / sidebar layouts), Spacer, Divider
  - **Basic** — Heading, Text, Button, Image, Icon, Video, List, Quote
  - **Sections** — Hero, Feature grid, Pricing, Testimonial, Stats, CTA, Footer
- **Responsive controls** — desktop / tablet / mobile, with per-breakpoint style overrides
- **Inspector** — content fields + style controls (typography, spacing, background, border, effects, layout)
- **Undo / redo** with smart history coalescing, plus keyboard shortcuts
  (`⌘Z` / `⌘⇧Z`, `⌘D` duplicate, `Delete` remove)
- **Layers** panel, **autosave**, **multi-page dashboard**, and **starter templates**
- **Publish** to a clean public page (`/p/<slug>`) and **export** a self-contained HTML file

## Getting started

```bash
npm install
npx prisma db push      # create the SQLite database (dev.db)
npm run dev             # http://localhost:3000
```

## Scripts

| Command         | Description               |
| --------------- | ------------------------- |
| `npm run dev`   | Start the dev server      |
| `npm run build` | Production build          |
| `npm run start` | Run the production build  |
| `npm test`      | Run the Vitest unit suite |

## Architecture

```
lib/
  types.ts          Block tree + style model
  tree.ts           Pure, immutable tree operations (insert/move/remove/duplicate)  <- unit-tested
  styles.ts         Responsive style resolver + scoped stylesheet generator          <- unit-tested
  registry.ts       Central block registry (drives palette, renderer, inspector)
  export-html.ts    Self-contained HTML document builder                             <- unit-tested
  templates.ts      Starter page templates
  page-service.ts   Content (de)serialization + unique slugs
components/
  BlockRenderer.tsx Clean recursive renderer (public page + preview + export)
  blocks/           Block render components (shared by editor + public)
  editor/           Editor UI (top bar, palette, layers, DnD canvas, inspector)
  dashboard/        Multi-page dashboard
store/
  editor-store.ts   Zustand store: tree, selection, viewport, undo/redo, autosave
app/
  page.tsx          Dashboard
  editor/[id]/      Builder
  p/[slug]/         Public published page
  api/pages/        CRUD + publish endpoints
```

The heart of the app is a **recursive block tree** (`{ id, type, props, styles,
children }`) stored as JSON. A single **component registry** maps each block type
to its renderer, default props/styles, and inspector schema — so the palette,
canvas, and settings panel all stay in sync from one source of truth.

## Engineering docs

Deeper design and operations material lives in [`docs/`](docs/):

| Doc                                                 | What it covers                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| [Features](docs/features.md)                        | Complete catalogue of everything the app can do                         |
| [Architecture Decision Records](docs/adr/README.md) | Why each technology/pattern was chosen and the trade-offs (11 ADRs)     |
| [Architecture diagrams](docs/architecture.md)       | Mermaid system context, request lifecycle, DnD sequence, ER, deployment |
| [Observability](docs/observability.md)              | Structured logs, Prometheus metrics, tracing, health checks             |
| [Performance post-mortem](docs/post-mortem.md)      | Load-test findings: the bottlenecks hit and how they were fixed         |

### Observability at a glance

The app emits all three pillars from [`lib/observability/`](lib/observability):

- **Logs** — structured JSON to stdout, auto-correlated with `trace_id`.
- **Metrics** — Prometheus exposition at `GET /api/internal/metrics`.
- **Traces** — per-request spans (AsyncLocalStorage); `x-trace-id` on every response.
- **Health** — `GET /api/internal/health` (liveness + DB readiness).

```bash
curl localhost:3000/api/internal/health
curl localhost:3000/api/internal/metrics   # set METRICS_TOKEN in production
```
