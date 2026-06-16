# 2. Pages as a recursive JSON block tree

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

A visual page builder needs an in-memory and on-disk representation of a page
that can express arbitrary nesting (sections containing columns containing
buttons), carry per-element content and styling, and round-trip losslessly
between the editor, the database, the public renderer, and HTML export.

## Decision

Model a page as a **recursive tree of `Block` nodes** serialized as JSON.

```ts
// lib/types.ts
type Block = {
  id: string;
  type: string;                 // key into the block registry (ADR 0003)
  props: Record<string, any>;   // content (text, src, options, …)
  styles: ResponsiveStyles;     // { desktop?, tablet?, mobile? } (ADR 0009)
  children: Block[];            // nested blocks
};
```

- The same tree drives **every** render surface: editor canvas, public page,
  preview, and HTML export.
- Tree manipulation (insert / move / remove / duplicate) lives in pure,
  immutable functions in `lib/blocks/tree.ts`.
- `props` and `styles` are intentionally loose (`Record<string, any>` /
  optional fields). The registry, not the type, defines what a block's props
  mean.

## Consequences

- **Positive:** A uniform shape makes recursion trivial — one renderer walks any
  page. New block types require no schema migration; they are just a new `type`
  string plus a registry entry.
- **Positive:** Immutable tree ops give cheap structural sharing and make
  undo/redo a matter of keeping previous tree references (ADR 0004).
- **Positive:** JSON serializes directly into a single DB column (ADR 0006) and
  into version snapshots.
- **Negative:** Loose `props`/`styles` typing pushes validation responsibility
  onto the registry and runtime, not the compiler. Malformed content is possible
  if a block renderer and its defaults drift apart.
- **Negative:** There is no referential integrity inside the tree (e.g. dangling
  collection references) — consistency is a runtime concern.

## Alternatives considered

- **Normalized/flat node table keyed by parent id.** Rejected: heavier to read
  and render; the tree is almost always loaded and saved whole, so nesting in
  JSON is simpler and faster for this workload.
- **HTML/Markdown as the source of truth.** Rejected: lossy for structured
  styling and editor metadata; hard to attach per-breakpoint styles and inspector
  state.
- **Strongly-typed discriminated union per block type.** Attractive for safety
  but rejected as too rigid: it couples the core type to every block and makes
  the registry-driven, data-defined block catalog (ADR 0003) far more verbose.
