# Design: Reusable UI Primitives on react-aria-components

**Date:** 2026-06-17
**Status:** Approved (design) — pending implementation plan
**Scope:** App chrome (shell + editor). Explicitly **excludes** user-generated page/block rendering.

## Problem

The app has **no shared interactive primitives**. Reconnaissance found:

- ~160 `<button>`, ~40 `<input>`, 5 native `<select>`, 4 `<textarea>` — almost all raw HTML with inline Tailwind, classes duplicated across files.
- The editor has an isolated `components/editor/controls.tsx` (TextInput, SelectInput, custom Popover, etc.) not reused by the app shell.
- `components/ui/Modal.tsx` + `dialog-provider.tsx` are solid but have **no focus trap / focus restoration**; the custom editor `Popover` has no keyboard nav or ARIA.
- Tokens are thin: the Untitled UI shadow scale already exists as `--shadow-*` CSS vars in `globals.css`, but brand color is `indigo-600` scattered inline and neutrals are raw `zinc`.

This is a net-add of a primitives layer where none exists — not a rip-out. The goal is a single reusable, accessible primitive set used across the whole chrome.

## Decisions (locked during brainstorming)

1. **Adoption depth:** Build our own primitives on **`react-aria-components`** (MIT, free), styled by us, using Untitled UI as the *visual reference only*. No paid Untitled UI dependency; we borrow patterns + token conventions, not their code.
2. **Token layer:** Tailwind v4 **`@theme`** semantic tokens (generate real utilities like `bg-brand-600`, `text-fg-muted`, `rounded-control`).
3. **Scope:** **Everything** — app shell **and** editor — but sequenced (foundation → prove → fan out) so even a full migration is verifiable and low-risk.
4. **Animation:** **framer-motion is retained.** It is not dropped from the app or the primitives. The Modal keeps its existing framer-motion shell; react-aria only adds focus management around it.

## Non-goals

- No changes to user-generated page/block rendering. Primitives must **never** leak into the published-page bundle (keeps react-aria out of the public render path).
- No new feedback colors beyond `danger` for now (YAGNI on success/warning until a real need appears).
- No replacement of `CommandPalette`'s bespoke command logic (its rows/inputs adopt primitives; full RAC autocomplete is an optional later pass).

## Architecture

### Token layer — `app/globals.css`, Tailwind v4 `@theme`

Sits beside the existing `--shadow-*` vars. Semantic names (not palette names) so a rebrand is a one-block edit:

```css
@theme {
  /* brand — replaces inline indigo-600 */
  --color-brand-50 … --color-brand-700;   /* primary = brand-600 */
  /* neutrals (semantic aliases over zinc) */
  --color-fg: #0a0d12; --color-fg-muted: #6b7280; --color-fg-subtle: #94a3b8;
  --color-bg: #fff;    --color-bg-subtle: #fafafa;
  --color-border: #e4e4e7; --color-border-strong: #d4d4d8;
  /* feedback */
  --color-danger-50/500/600/700;
  /* shape + focus */
  --radius-control: .5rem; --radius-panel: 1rem;
  --color-ring: <brand-100>;
}
```

Generated utilities used by primitives: `bg-brand-600`, `text-fg-muted`, `border-subtle`, `rounded-control`, `ring-ring`, etc.

### Primitive inventory — `components/ui/`

All `"use client"`, thin `react-aria-components` wrappers + Tailwind via the existing `cn()` helper. Barrel export from `components/ui/index.ts`.

| Primitive | Built on | Notable API |
|---|---|---|
| `Button` | RAC `Button` | `variant`: primary·secondary·ghost·danger·link; `size`: sm·md·lg·icon; `isLoading`, `leadingIcon`/`trailingIcon` |
| `TextField` (Input) | RAC `TextField`+`Input`+`Label`+`FieldError` | `label`, `description`, `errorMessage`, `size`, adornments |
| `Textarea` | RAC `TextField`+`TextArea` | rows, optional autosize |
| `Select` | RAC `Select`+`ListBox`+`Popover` | replaces native `<select>` |
| `Menu` | RAC `MenuTrigger`+`Menu` | action menus (PageCard ⋯ etc.) |
| `Dialog` | RAC `Modal`+`ModalOverlay`+`Dialog` | focus trap + restore + Esc |
| `Checkbox` / `Switch` / `RadioGroup` | RAC equivalents | `Switch` replaces editor `Toggle` |
| `Tooltip` | RAC `Tooltip` | for icon-only buttons |
| `Popover` (low-level) | RAC `Popover` | reused by editor `ColorInput` etc. |

`Table` and `Skeleton` stay as-is (presentational, already semantic).

### Modal compatibility

Reimplement `Modal.tsx` on RAC internally but **keep its props identical** (`open`, `onClose`, `align`, `dismissible`, `labelledBy`). Every existing modal caller gains focus-trap/restore with **zero call-site changes**. `dialog-provider`'s confirm/alert rebuild on the new `Dialog`; confirm uses `role="alertdialog"`.

### Animation

framer-motion retained. The `Modal`/`Dialog` keeps its current framer-motion shell (spring backdrop + scale-in); we wrap content in react-aria `FocusScope` (`contain` + `restoreFocus` + `autoFocus`). Menus/Selects/Popovers get a light enter/exit (framer or CSS — a per-component cosmetic call, not architecture). Non-overlay primitives don't animate.

## Editor reconciliation — `components/editor/`

Specialized controls **keep their behavior**, rebuilt on the new base:

| Editor control | Becomes |
|---|---|
| `TextInput` / `NumberInput` / `TextArea` | wrappers over `TextField` / `Textarea` base |
| `SelectInput` | `Select` |
| `Toggle` | `Switch` |
| editor `Popover` | shared low-level `Popover` (delete the duplicate) |
| `Segmented` (e.g. text-align) | RAC `ToggleButtonGroup` (single-select) |
| `Slider` | RAC `Slider` — gains keyboard + ARIA, keeps readout/styling |
| `UnitInput` (drag-to-scrub) | keeps scrub logic; input on `TextField` base, unit picker on `Select` |
| `ColorInput` (swatches/recent/tokens) | keeps all logic; popover → shared `Popover` |
| `ImageInput` / `FileInput` / `Field` | keep; trigger buttons → `Button` |
| `ContextMenu` | `Menu` (keyboard nav + focus) |
| `TopBar` icon buttons | `Button` (icon variant) + `Tooltip` |
| `RichTextToolbar` dropdown | `Menu`/`Popover` |
| `CommandPalette` | bespoke logic stays; rows/inputs use primitives |

## Known risk: iframe outside-press dismissal

react-aria overlays render in the **parent** document and listen for outside-clicks there. The canvas is an **iframe** — a click inside it is a separate document the parent never sees, so an open Select/Menu/Popover **won't auto-dismiss** when the user clicks into the canvas. Mitigation: bridge iframe `pointerdown` → close open overlays (reuse the pattern the current editor `Popover` likely already uses). This is why the editor migrates **last**, with heavy manual verification.

## Migration sequence (everything, sequenced to de-risk)

- **Phase 0 — Foundation:** add `react-aria-components`; build the `@theme` token layer; verify it compiles.
- **Phase 1 — Core primitives + unit tests:** Button, TextField, Textarea, Select, Menu, Popover, Dialog, Checkbox, Switch, RadioGroup, Tooltip; barrel export.
- **Phase 2 — Modal/dialog swap:** reimplement `Modal` internals (FocusScope, keep framer-motion + props identical), rebuild `dialog-provider`. Zero modal call-site changes.
- **Phase 3 — App-shell migration (surface by surface):** Settings (proof) → Dashboard/PageCard → Sidebar/WorkspaceSwitcher/CommandPalette → CMS manager → invites/auth. Each surface is its own verifiable chunk.
- **Phase 4 — Editor migration (last):** `controls.tsx`, ContextMenu, TopBar, RichTextToolbar, Color/Unit popovers; resolve the iframe dismissal bridge.
- **Phase 5 — Cleanup:** delete the duplicate `Popover`, grep for stray raw `<button>`/`<select>` in chrome, short usage doc.

## Testing

- **Unit (vitest + @testing-library/react + user-event):** per primitive — variants, disabled, error state, controlled value, keyboard (Space/Enter activates Button; arrow nav in Menu/Select; Esc closes).
- **A11y assertions:** Dialog focus trap, focus restoration on close, ARIA wiring present.
- **Interaction smoke (Playwright — already a dep):** pick a Select via keyboard; Dialog tab-cycle + Esc + focus return; the editor popover-over-iframe dismissal.
- **Gate:** `tsc --noEmit` + `vitest run`. **Not `next build`** — it clobbers the live dev server. Playwright runs separately.

## Other risks

- **RAC API drift:** verify current `react-aria-components` API against its docs before writing — do not rely on memory/training.
- **Boundary:** primitives are `"use client"` and must never be imported into published-page/block rendering, keeping react-aria out of the public bundle.
- **Big diff:** phased delivery with per-phase verification keeps each change reviewable.
