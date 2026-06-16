# 3. A central block registry as the single source of truth

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

Each block type needs to participate in many subsystems: the palette (label,
icon, category), the canvas/public renderer (a React component), the inspector
(which content fields and style groups to show), default props and styles when
inserted, container semantics (can it accept children?), AI generation schema,
and HTML export. Without a single definition these representations drift, and
adding a block means touching a dozen files.

## Decision

Define each block **once** as a `BlockDefinition` and aggregate all definitions
into a **central registry** (`lib/blocks/registry.ts`). Definitions are grouped
by category in `components/blocks/*.defs.ts` (layout, basic, sections, form,
navbar, embed, file, collection).

Convention:

- **`*.defs.ts`** — registry metadata: `type`, label, category, palette info,
  default `props`/`styles`, inspector `fields`, `styleGroups`, container flag,
  and a reference to the render component.
- **`*.tsx`** — the render component itself, shared by editor and public output.

The palette, inspector, renderer, defaults, AI schema, and export all derive
from this one registry.

## Consequences

- **Positive:** Adding a block is a localized change — one `.defs.ts` entry plus
  one `.tsx` renderer. Every surface updates automatically.
- **Positive:** Eliminates drift between palette, inspector, and renderer because
  they read the same definition.
- **Positive:** Enables generic, data-driven UI: the inspector renders from
  `fields`/`styleGroups` rather than bespoke panels per block.
- **Negative:** The registry is a central coupling point and a potential
  bottleneck; a malformed definition can break multiple surfaces at once.
- **Negative:** Very specialized blocks must still express themselves through the
  generic field/style-group vocabulary, which can be limiting.

## Alternatives considered

- **Self-registering components (each block registers itself on import).**
  Rejected: import-order/side-effect fragility and harder static reasoning about
  the full catalog.
- **Per-block bespoke inspector panels.** Rejected: more flexible but far more
  code and the very drift this ADR exists to prevent.
- **Config-only blocks (no code component).** Insufficient: real blocks need
  custom render/interaction (e.g. rich text, collection lists), so a component
  reference in the definition is required.
