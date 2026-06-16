# Inspector Split (Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Split the 808-line `Inspector.tsx` into a ~60-line thin `FloatingInspector` entry plus four focused units under `components/editor/inspector/`, behavior-preserving.

**Architecture:** Move each cohesive concern into its own co-located file — `style-fields.tsx` (the per-field style widgets + the data-driven `StyleGroupView`/`Section`), `block-controls.tsx` (the per-block sections + the content-field renderer), `InspectorContent.tsx` (the content/style tabs component), and `useFloatingPanel.ts` (the floating panel's position/drag/resize/dock mechanics) — then `Inspector.tsx` keeps only the thin `FloatingInspector` that calls the hook and renders the panel shell around `<InspectorContent>`.

**Tech Stack:** Next.js 16, React 19, framer-motion, zustand, Vitest 4 (node + jsdom), TypeScript 5.

---

> **Verification reality:** the inspector wires the whole selection/style UI over the iframe canvas and has NO unit test (not meaningfully renderable in jsdom). Every task is a **behavior-preserving extract verified by `npx tsc --noEmit` + `npm test` (111 must stay green) + `npm run build` + a manual editor smoke pass.** Subtle bits to NOT regress: the per-breakpoint style reset dots, the spacing link toggle, the data-driven style groups, the floating-panel drag/resize/dock + the iframe-pointer passthrough + the position recompute on scroll/zoom/select, and ESC-to-deselect.

> **Move verbatim.** The code exists in `components/editor/Inspector.tsx`. Move each block UNCHANGED; only its location + imports change. Do NOT fold in the known `compute`-on-every-`tree`-change re-render optimization — that's a separate deferred item. Each task ends with `Inspector.tsx` fully working and still exporting `FloatingInspector` (its only external consumer is `EditorClient`).

> **New files live in `components/editor/inspector/`** so their relative imports are `../controls`, `../custom-inspectors`, `../editor-actions`, `../iframe-context`, `../drag-context`; `@/...` absolute imports are unchanged.

> **`tsc` drives import cleanup.** After each extraction, remove exactly what tsc flags as unused in `Inspector.tsx`.

> **Every commit** ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
> **Branch first:** `git switch -c refactor/inspector-split`. Don't stage `prisma/dev.db`.

---

## File Structure

| File | Responsibility | Exports | Task |
|------|----------------|---------|------|
| `components/editor/inspector/style-fields.tsx` | `useStyleField`, `useThemeSwatches`, `SRow`, `SUnit/SText/SColor/SSelect/SSegment/SOpacity`, `SpacingControl`, `StyleControl`, `StyleGroupView`, `Section` | `StyleGroupView`, `Section` | 1 |
| `components/editor/inspector/block-controls.tsx` | `TextStyleControl`, `StyleActions`, `VisibilityControl`, `AttributesControl`, `MotionSection`, `ContentField`, `VP`, `ANIM_OPTIONS` | `TextStyleControl`, `StyleActions`, `VisibilityControl`, `AttributesControl`, `MotionSection`, `ContentField`, `VP` | 2 |
| `components/editor/inspector/InspectorContent.tsx` | the content/style tabs component | `InspectorContent` | 3 |
| `components/editor/inspector/useFloatingPanel.ts` | panel position/drag/resize/dock/scroll-tracking | `useFloatingPanel` | 4 |
| `components/editor/Inspector.tsx` | thin `FloatingInspector` (hook + panel shell + `<InspectorContent>`) | `FloatingInspector` | 4 |

---

## Task 1: Extract `style-fields.tsx`

**Files:** Create `components/editor/inspector/style-fields.tsx`; modify `Inspector.tsx`.

- [ ] **Step 1: Create `components/editor/inspector/style-fields.tsx`**

Move VERBATIM from `Inspector.tsx` (current lines ~33–233): `useStyleField`, `useThemeSwatches`, `SRow`, `SUnit`, `SText`, `SColor`, `SSelect`, `SSegment`, `SOpacity`, `SpacingControl`, `StyleControl`, `StyleGroupView`, `Section`. Add `export` to `StyleGroupView` and `Section` (the rest stay file-internal). Header:

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Link2, X } from "lucide-react";
import { findBlockById } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { StyleGroup, StyleProps } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { ColorInput, Segmented, SelectInput, Slider, TextInput, UnitInput } from "../controls";
import { STYLE_GROUP_SCHEMAS, type StyleFieldDef } from "@/lib/style-groups";
```
(Then the moved code. `StyleGroupView` uses `Section`, `StyleControl`, `STYLE_GROUP_SCHEMAS`; `StyleControl` uses the `S*` controls; the `S*` use `useStyleField` + `SRow` + the `../controls` inputs; `SColor` uses `useThemeSwatches`. All self-contained here.)

- [ ] **Step 2: Rewire `Inspector.tsx`**
Delete those 13 definitions from `Inspector.tsx`. Add `import { StyleGroupView, Section } from "./inspector/style-fields";`. (`Section` is still used by `MotionSection`, still in Inspector for now; `StyleGroupView` by `InspectorContent`, still in Inspector for now.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; remove imports tsc flags as now-unused in `Inspector.tsx` (likely `Slider`, `Segmented`, `UnitInput`, `ColorInput`, `Link2`, `findBlockById`, `StyleProps`/`StyleGroup` types, `StyleFieldDef`, `STYLE_GROUP_SCHEMAS` — but KEEP anything still referenced by the remaining Inspector code: e.g. `SelectInput`/`TextInput`/`NumberInput` used by block sections, `cn`, `useEditor`, `ChevronDown`?/`X` used elsewhere). Only remove what tsc reports. `npm test` → 111. `npm run build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add components/editor/inspector/style-fields.tsx components/editor/Inspector.tsx
git commit -m "refactor(inspector): extract style-field controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Extract `block-controls.tsx`

**Files:** Create `components/editor/inspector/block-controls.tsx`; modify `Inspector.tsx`.

- [ ] **Step 1: Create `components/editor/inspector/block-controls.tsx`**

Move VERBATIM from `Inspector.tsx`: `TextStyleControl`, `StyleActions`, `VisibilityControl`, `AttributesControl`, `ANIM_OPTIONS` + `MotionSection`, `ContentField`, and the `VP` const. Add `export` to `TextStyleControl`, `StyleActions`, `VisibilityControl`, `AttributesControl`, `MotionSection`, `ContentField`, and `VP` (`ANIM_OPTIONS` stays internal). Header:

```tsx
"use client";

import { ClipboardPaste, Copy, Eye, EyeOff, Monitor, Plus, Smartphone, Tablet, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block, SettingField, Viewport } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useDesignSystem } from "@/store/design-system";
import { Field, NumberInput, SelectInput, TextInput } from "../controls";
import { ItemsEditor, LEAF_INPUTS } from "@/lib/field-inputs";
import { Section } from "./style-fields";
```
(Then the moved code. `MotionSection` uses `Section` from `./style-fields`; `VisibilityControl` uses `VP` + `cn`; `ContentField` uses `Field`/`ItemsEditor`/`LEAF_INPUTS`. `VP` is module-level — placement within the file doesn't matter since it's referenced at render time.)

- [ ] **Step 2: Rewire `Inspector.tsx`**
Delete those definitions (`TextStyleControl`, `StyleActions`, `VisibilityControl`, `AttributesControl`, `ANIM_OPTIONS`, `MotionSection`, `ContentField`, `VP`) from `Inspector.tsx`. Add:
```tsx
import {
  AttributesControl,
  ContentField,
  MotionSection,
  StyleActions,
  TextStyleControl,
  VisibilityControl,
  VP,
} from "./inspector/block-controls";
```
(All are consumed by `InspectorContent`, still in Inspector for now.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; remove now-unused Inspector imports (likely `Type`/`Plus`/`Eye`/`EyeOff`/`ClipboardPaste` lucide icons, `useDesignSystem`, `Field`, `NumberInput`, `ItemsEditor`/`LEAF_INPUTS`, `SettingField`/`Viewport` types — but KEEP what `InspectorContent`/`FloatingInspector` still use: `Copy`/`Trash2`/`GripVertical`/`PanelRight`/`X`/`Monitor`/`Smartphone`/`Tablet`/`ComponentIcon`, `SelectInput`?/`TextInput`?). Only remove what tsc reports. `npm test` → 111. `npm run build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add components/editor/inspector/block-controls.tsx components/editor/Inspector.tsx
git commit -m "refactor(inspector): extract per-block control sections

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extract `InspectorContent.tsx`

**Files:** Create `components/editor/inspector/InspectorContent.tsx`; modify `Inspector.tsx`.

- [ ] **Step 1: Create `components/editor/inspector/InspectorContent.tsx`**

Move the `InspectorContent` function VERBATIM (current lines ~425–573) and `export` it. Header:

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Component as ComponentIcon, Copy, GripVertical, PanelRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useBreakpoints } from "@/store/breakpoints";
import { getDefinition } from "@/lib/registry";
import { useEditorActions } from "../editor-actions";
import { CUSTOM_INSPECTORS } from "../custom-inspectors";
import { StyleGroupView } from "./style-fields";
import {
  AttributesControl,
  ContentField,
  MotionSection,
  StyleActions,
  TextStyleControl,
  VisibilityControl,
  VP,
} from "./block-controls";
```
(The `InspectorContent` body is unchanged — it already references all of these.)

- [ ] **Step 2: Rewire `Inspector.tsx`**
Delete the `InspectorContent` function from `Inspector.tsx`. Add `import { InspectorContent } from "./inspector/InspectorContent";`. Remove the now-redundant `StyleGroupView`/block-controls imports from `Inspector.tsx` (they were only used by `InspectorContent`, which now imports them itself) — let tsc confirm. `FloatingInspector` still renders `<InspectorContent block={block} onHandlePointerDown={...} dragging={...} docked={...} onToggleDock={...} />` unchanged.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean (remove all now-unused imports tsc flags — after this task `Inspector.tsx` should import little beyond what `FloatingInspector` needs: `useCallback/useEffect/useLayoutEffect/useState` from react, `AnimatePresence`/`motion`, `cn`, `useEditor`/`useSelectedBlock`, `useIframe`, `useCanvasZoom`, `useDrag`, and `InspectorContent`). `npm test` → 111. `npm run build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add components/editor/inspector/InspectorContent.tsx components/editor/Inspector.tsx
git commit -m "refactor(inspector): extract InspectorContent tabs component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Extract `useFloatingPanel` + thin `Inspector.tsx`

Extract the floating-panel mechanics from `FloatingInspector` into a hook; `Inspector.tsx` keeps only the thin render.

**Files:** Create `components/editor/inspector/useFloatingPanel.ts`; modify `Inspector.tsx`.

- [ ] **Step 1: Create `components/editor/inspector/useFloatingPanel.ts`**

```ts
"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useEditor, useSelectedBlock } from "@/store/editor-store";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useIframe } from "../iframe-context";
import { useDrag } from "../drag-context";

const PANEL_WIDTH = 304;
const LEFT_PANEL = 256; // keep clear of the components panel
const GAP = 14;
const DOCK_THRESHOLD = 60; // px from the right edge that triggers docking
const clampW = (w: number) => Math.max(264, Math.min(w, 560));

type PanelPos = { left: number; top: number; maxHeight: number };

/**
 * Drives the floating inspector panel: tracks the selected block, computes the
 * anchored position (translating iframe-internal rects to top-document/zoom
 * coords), and handles drag-to-move, edge-resize, dock-to-right, ESC-to-close,
 * and live repositioning on scroll/resize/zoom. Returns everything the panel
 * shell needs to render.
 */
export function useFloatingPanel() {
  // <-- MOVE VERBATIM the entire body of the current FloatingInspector (current
  //     lines ~587-760), i.e. EVERYTHING from `const block = useSelectedBlock();`
  //     down to and INCLUDING the `eff` / `show` / `style` computation
  //     (the `const style: React.CSSProperties = docked ? {...} : {...};` block).
  //     Keep all state, setFramePassthrough, both effects, handlePointerDown,
  //     handleResizeDown, compute (useCallback), the useLayoutEffect, the
  //     scroll-tracking useEffect — UNCHANGED.

  const toggleDock = useCallback(() => setDocked((d) => !d), []);

  return {
    block,
    show,
    style,
    width,
    dragging,
    resizing,
    docked,
    dockHint,
    handlePointerDown,
    handleResizeDown,
    toggleDock,
  };
}
```
Move the indicated code verbatim. Note: `block`, `show`, `style`, `width`, `dragging`, `resizing`, `docked`, `dockHint`, `handlePointerDown`, `handleResizeDown` are all already defined in that body; `toggleDock` is new (replacing the inline `onToggleDock={() => setDocked((d) => !d)}` from the render). The `PanelPos` type + the 5 constants move here too (shown above — delete them from Inspector).

- [ ] **Step 2: Replace `Inspector.tsx` with the thin entry**

The ENTIRE file becomes:

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFloatingPanel } from "./inspector/useFloatingPanel";
import { InspectorContent } from "./inspector/InspectorContent";

export function FloatingInspector() {
  const {
    block,
    show,
    style,
    width,
    dragging,
    resizing,
    docked,
    dockHint,
    handlePointerDown,
    handleResizeDown,
    toggleDock,
  } = useFloatingPanel();

  return (
    <>
      {/* dock-zone preview while dragging toward the right edge */}
      {dragging && dockHint && (
        <div
          className="pointer-events-none fixed z-[39] border-l-2 border-indigo-400 bg-indigo-500/10"
          style={{ top: 56, bottom: 0, right: 0, width }}
        />
      )}
      <AnimatePresence>
        {show && block && (
          <motion.aside
            key={block.id}
            initial={{ opacity: 0, scale: 0.97, x: docked ? 8 : -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={dragging || resizing ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34 }}
            style={style}
            className={cn(
              "z-40 flex flex-col overflow-hidden border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5",
              docked ? "border-l rounded-none" : "rounded-2xl border",
              (dragging || resizing) && "ring-indigo-300/60 select-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* resize handle on the left edge */}
            <div
              onPointerDown={handleResizeDown}
              className="group absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize"
              title="Drag to resize"
            >
              <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-indigo-400" />
            </div>
            <InspectorContent
              block={block}
              onHandlePointerDown={handlePointerDown}
              dragging={dragging}
              docked={docked}
              onToggleDock={toggleDock}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
```
This JSX is byte-identical to the current `FloatingInspector` return, with `onToggleDock={() => setDocked((d) => !d)}` replaced by `onToggleDock={toggleDock}`.

- [ ] **Step 3: Verify**
`npx tsc --noEmit` → clean. `npm test` → 111. `npm run build` → succeeds. `npx fallow 2>&1 | grep -iE "circular"` → still 0 (no new cycle among the inspector files). Confirm `Inspector.tsx` still exports `FloatingInspector` and nothing else imports the moved internals from `./Inspector` (`grep -rn "from \"./Inspector\"\|from \"@/components/editor/Inspector\"" components app` → only `FloatingInspector`).
Manual: select a block → panel appears anchored next to it; switch Content/Style tabs; edit a style field (reset dot appears, spacing link toggles); drag the panel by its header; resize via the left edge; drag to the right edge to dock / undock; scroll the canvas (panel re-anchors); ESC deselects/closes.

- [ ] **Step 4: Commit**
```bash
git add components/editor/inspector/useFloatingPanel.ts components/editor/Inspector.tsx
git commit -m "refactor(inspector): extract useFloatingPanel; Inspector is a thin entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist
- [ ] `Inspector.tsx` is a ~60-line thin `FloatingInspector` (hook + panel shell + `<InspectorContent>`); still the only external consumer is `EditorClient` (import unchanged).
- [ ] Behavior preserved: style reset dots, spacing link, data-driven style groups, content/style tabs, custom inspector (collection), attributes, motion, save-as-component/duplicate/delete/close header actions, panel drag/resize/dock, iframe-pointer passthrough, position recompute on scroll/resize/zoom/select, ESC-to-close.
- [ ] Name consistency: `StyleGroupView`/`Section`; `TextStyleControl`/`StyleActions`/`VisibilityControl`/`AttributesControl`/`MotionSection`/`ContentField`/`VP`; `InspectorContent`; `useFloatingPanel`.
- [ ] No new circular deps (`npx fallow` → 0). `npx tsc --noEmit && npm test && npm run build` green (111). Manual smoke clean.

## Deferred
- The `compute`-on-every-`tree`-change re-render optimization in `useFloatingPanel` (recomputes panel position on each keystroke) — scope it to selected-block changes in a follow-up.
- Remaining large functions (`useEditor` store 285, `DomTreePanel`, `Dashboard`, `CommandPalette`, `CollectionManager`).
