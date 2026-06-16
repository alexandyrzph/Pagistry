# 4. Zustand store with immutable tree ops and undo/redo

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

The editor mutates the block tree constantly (drag inserts, prop edits, style
changes) and must support undo/redo, keyboard shortcuts, autosave, and a
selection model. This is high-frequency client state that the public render path
never touches. We needed client state management that is lightweight, avoids
boilerplate, and plays well with React 19 without forcing global re-renders.

## Decision

Use **Zustand** as the editor's client state container (`store/editor-store.ts`),
built on the immutable tree operations from `lib/blocks/tree.ts`.

- All document mutations (`addBlock`, `moveExisting`, `duplicate`, `setProp`,
  `setStyle`, …) produce a **new tree** via pure functions.
- Undo/redo is implemented with `past` / `future` snapshot stacks, with history
  **coalescing** so rapid edits (e.g. typing, dragging a slider) collapse into a
  single undo step.
- Focused, secondary stores own orthogonal concerns: `editor-ui.ts`,
  `breakpoints.ts`, `canvas-zoom.ts`, `design-system.ts`, `richtext.ts`.
- React Context is used for dependency-style data that is read widely but rarely
  changes (components map, collections, site, drag info, iframe handle).

## Consequences

- **Positive:** Minimal boilerplate vs. Redux; selector subscriptions keep
  re-renders narrow despite a large tree.
- **Positive:** Immutability makes undo/redo a matter of holding prior tree
  references — cheap thanks to structural sharing.
- **Positive:** Splitting stores keeps unrelated state (zoom, breakpoint) from
  invalidating document subscribers.
- **Negative:** State is spread across several stores plus contexts; contributors
  must know which holds what. The boundary between "store" and "context" is a
  judgment call.
- **Negative:** History coalescing rules are heuristic and need care to avoid
  surprising undo granularity.

## Alternatives considered

- **Redux Toolkit.** Rejected: more ceremony than needed for a single-surface
  editor; undo/redo and coalescing would still be hand-rolled.
- **React Context + `useReducer` only.** Rejected: coarse re-renders for a tree
  this size; selector ergonomics are poor.
- **Immer-based mutation.** Considered; the codebase favours explicit pure tree
  functions (which are independently unit-tested) over proxy-based drafts.
