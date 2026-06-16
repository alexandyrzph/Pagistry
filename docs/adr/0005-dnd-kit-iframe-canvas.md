# 5. dnd-kit drag-and-drop inside an iframe canvas

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

The canvas must render author content *exactly* as it will appear when
published — including arbitrary author CSS, fonts, and responsive widths at a
simulated device size — while the editor draws its own chrome (selection
outlines, drag ghosts, insertion indicators) on top. Two problems follow:

1. **Style isolation.** Author styles and the editor's own Tailwind UI must not
   bleed into each other.
2. **Accurate responsive preview.** Tablet/mobile widths and media queries must
   reflect the real viewport, not the editor window.

Drag-and-drop must work across this boundary, with zoom support.

## Decision

Render the editable page inside an **iframe** (`CanvasFrame.tsx`) and implement
drag-and-drop with **dnd-kit**, mapping coordinates between iframe and parent.

- Author content lives in the iframe document; editor chrome
  (`CanvasOverlay.tsx`, selection handles, `GhostCard.tsx`) lives in the parent
  document, positioned over the iframe.
- `DndContext` is configured with custom measuring and a collision strategy that
  is **iframe-aware**: drag coordinates are translated from iframe space into the
  parent and scaled by the canvas zoom level.
- During an active drag, the iframe is given `pointer-events: none` so dnd-kit in
  the parent keeps receiving pointer events.
- Auto-scroll and insertion indicators are computed against iframe geometry.

## Consequences

- **Positive:** True style isolation and accurate responsive/zoom preview — the
  canvas matches published output, and editor CSS can't leak into author content.
- **Positive:** dnd-kit provides accessible, sensor-based DnD without owning the
  DOM, which suits the split render/chrome model.
- **Negative:** Significant complexity in coordinate mapping (iframe ↔ parent ↔
  zoom) and event routing. This is the most intricate part of the editor.
- **Negative:** Some DnD edge cases (auto-scroll, measuring during drag, fast
  pointer moves) require bespoke handling that wouldn't exist in a same-document
  canvas.
- **Negative:** Iframe content cannot be inspected/interacted with via tooling
  that ignores frame boundaries.

## Alternatives considered

- **Same-document canvas with CSS scoping (Shadow DOM / prefixing).** Rejected:
  media queries key off the real viewport, breaking responsive preview; full
  style isolation is hard to guarantee.
- **Native HTML5 drag-and-drop.** Rejected: poor control over drag previews and
  drop targeting, weaker accessibility, and awkward across frames.
- **A different DnD library (react-dnd).** dnd-kit was preferred for its sensor
  model, accessibility, and customizable measuring/collision needed for the
  iframe case.
