# 9. Per-breakpoint styles compiled to scoped stylesheets

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

Authors set styles per element and per breakpoint (desktop / tablet / mobile),
and want site-wide design tokens (brand colors, typography presets) that cascade.
These styles must render identically in the editor iframe, the public page, and
the exported standalone HTML — without inline-style sprawl and without leaking
between blocks.

## Decision

Store styles on each block as **`ResponsiveStyles`** (`{ desktop?, tablet?,
mobile? }` of `StyleProps`) and compile them to a **scoped stylesheet** at render
time via `lib/blocks/styles.ts`.

- Each block gets a stable class derived from its id (e.g. `b-<id>`); the
  resolver emits rules for that class, wrapping tablet/mobile overrides in media
  queries.
- Design-system tokens are emitted as CSS custom properties
  (`var(--pc-color-<id>)`); typography presets link via a `ts-<id>` class. Tokens
  live on the workspace `Site` and cascade to all blocks.
- The same resolver feeds the editor canvas, the public `BlockRenderer`, and the
  HTML export (`lib/blocks/export-html.ts`), so output is consistent everywhere.
- The active breakpoint is editor-only UI state (`store/breakpoints.ts`); the
  generated CSS itself is responsive via media queries.

## Consequences

- **Positive:** One styling model produces identical results across editor,
  public, and export. Per-id class scoping prevents cross-block bleed.
- **Positive:** Design tokens as CSS variables give real cascade — change a brand
  color once, every block updates.
- **Positive:** Media-query output means published pages are genuinely
  responsive without shipping editor logic.
- **Negative:** A custom style resolver is bespoke surface area to maintain and
  must mirror the `StyleProps` vocabulary; new CSS properties require resolver
  support, not just a type field.
- **Negative:** Generated stylesheets grow with page size (one rule set per
  block); very large pages produce large stylesheets.
- **Negative:** The `StyleProps` allowlist constrains authors to supported
  properties by design.

## Alternatives considered

- **Inline styles on each element.** Rejected: no media queries, poor
  cascade/token support, and bulky repeated declarations.
- **Tailwind utility classes per block.** Rejected: hard to map arbitrary
  per-breakpoint numeric values to a fixed utility set; export would still need a
  Tailwind build.
- **CSS-in-JS at runtime on public pages.** Rejected: adds client runtime cost to
  otherwise static published pages; the resolver emits plain CSS instead.
