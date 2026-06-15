# Drag-and-Drop Page Builder — Design Spec

**Date:** 2026-06-13
**Status:** Approved

## Goal

A beautiful, clean, fullstack page builder app (Divi-like) with a rich component
library, smooth drag-and-drop, and a live responsive preview. Pages persist to a
database, can be published to a public URL, and exported as standalone HTML.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript** — single repo; API routes are the backend.
- **Prisma + SQLite** — durable page storage.
- **Tailwind CSS** — editor chrome + rendered blocks.
- **dnd-kit** — drag-and-drop with custom drop indicators.
- **Zustand** — editor state (tree, selection, viewport) + snapshot-based undo/redo.
- **lucide-react** icons, **Framer Motion** for subtle polish.
- **Vitest** — unit tests for tree ops, history, HTML export.

## Core architecture: block tree + registry

Every page is a recursive tree of nodes: `{ id, type, props, styles, children[] }`.
`styles` supports per-viewport overrides: `{ desktop, tablet?, mobile? }`.

A central **component registry** maps each `type` →
`{ label, icon, category, defaultProps, defaultStyles, Render, settings schema }`.
This single registry drives the palette, the canvas renderer, and the inspector.

A single `<BlockRenderer>` recursively renders the tree:
- **Editor canvas** wraps it with selection/hover chrome + drop zones.
- **Public page** renders it clean.

## Component library

- **Layout:** Section, Columns (1–4), Spacer, Divider
- **Basic:** Heading, Text, Button, Image, Icon, Video, List, Quote
- **Sections (composites):** Hero, Feature grid, Pricing, Testimonial, Stats, CTA, Footer

Each exposes content props + style controls (spacing, color, typography, alignment,
background, radius, etc.).

## Editor UI

- **Top bar:** title, viewport switcher (desktop/tablet/mobile), undo/redo, preview toggle, Save, Publish, Export HTML.
- **Left panel:** tabs — Components (draggable palette by category) and Layers (tree).
- **Center canvas:** responsive frame, live preview, hover outlines, selected-block toolbar (drag/duplicate/delete), animated drop indicators.
- **Right inspector:** content + style controls with per-viewport tabs.

## Data flow & persistence

- Zustand working tree → debounced autosave + explicit Save → `PUT /api/pages/[id]`.
- **Routes:** `/` dashboard · `/editor/[id]` builder · `/p/[slug]` public page.
- **API:** `GET/POST /api/pages`, `GET/PUT/DELETE /api/pages/[id]`, `POST /api/pages/[id]/publish`.
- **Export HTML:** serialize tree → self-contained downloadable HTML.

## Visual direction

Clean, airy editor chrome (neutral light UI, soft shadows, rounded corners, slate/indigo
accent). Built pages can be bold; the builder stays minimal so content is the star.

## Testing

Vitest covers the bug-prone pure logic: block-tree operations (add/move/delete/duplicate),
undo/redo history, and HTML export serialization. Drag interactions verified by running the app.

## Build phases

1. Scaffold + DB (Prisma/SQLite)
2. Types + component registry + block components
3. BlockRenderer
4. Zustand store + history
5. DnD canvas
6. Inspector
7. API + dashboard + persistence
8. Publish + public page + export HTML
9. Templates + polish + tests
