# Block Registry Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding/finding a block easy and the registry maintainable — by turning each block definition into pure data co-located with its Render component, splitting the 726-line `lib/registry.ts` into a thin collector over per-file definition arrays, and moving the hardcoded `columns` child-rendering rule onto the definition.

**Architecture:** Two steps. (1) Make definitions self-describing data: replace the `createChildren` *function* with a `defaultChildren: string[]` array, add a `containerStrategy` field, and make `EditorBlock` render containers generically. (2) Move each block's `BlockDefinition` into its existing co-located component file (e.g. `components/blocks/basic.tsx`) as an exported array; `lib/registry.ts` becomes a collector that assembles `REGISTRY` + keeps explicit `CATEGORIES` + the `createBlock`/`getDefinition` helpers. A registry-integrity test (written first) guards the split.

**Tech Stack:** Next.js 16, React 19, Vitest 4 (node + jsdom projects), TypeScript 5, lucide-react.

---

> **Why `defaultChildren` (data) instead of `createChildren` (function):** today `columns.createChildren = () => [createBlock("column"), createBlock("column")]` calls back into `lib/registry.ts`. If a co-located definition file kept that function, the file would have to import `createBlock` from the registry while the registry imports the file's definitions — a fragile import cycle. Making it pure data (`defaultChildren: ["column", "column"]`, resolved by `createBlock`) keeps every definition file a leaf that imports nothing from the registry. This is the linchpin that makes Task 2 cycle-free.

> **Verification:** `REGISTRY`/`CATEGORIES`/`createBlock` are importable in the node test env (the existing `tests/store.test.ts` already pulls the whole registry transitively), so the **registry-integrity test is real TDD** and runs in Task 1 — it then guards the Task-2 move. Both tasks also gate on `npx tsc --noEmit` + `npm test` + `npm run build`. The split (Task 2) is a behavior-preserving code move; `tsc` catches broken imports, the integrity test catches a dropped/miscategorized block.

> **Every commit** ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
> **Branch first:** `git switch -c refactor/block-registry` (repo is on `main`). Don't stage `prisma/dev.db`.
> **`tsc` flags unused imports** after moves — delete what it reports in the files you touched.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `lib/registry-types.ts` | `BlockDefinition`: drop `createChildren`, add `defaultChildren?: string[]`, `containerStrategy?: "slotted" \| "fixed"`, `emptyMinHeight?: number` | 1 |
| `lib/registry.ts` | T1: `createBlock` resolves `defaultChildren`; `columns`/`column`/`section` get the new fields. T2: becomes a thin collector over per-file definition arrays | 1, 2 |
| `components/editor/EditorBlock.tsx` | Render containers via `containerStrategy` (no `columns` special-case) | 1 |
| `tests/registry.test.ts` | Registry-integrity test (keys↔types, categories, defaultChildren, createBlock) | 1 |
| `components/blocks/shared.tsx` | Export shared `ALIGN_OPTIONS` | 2 |
| `components/blocks/{layout,basic,embed,file,navbar,form,sections,collection}.tsx` | Each exports a `BlockDefinition[]` co-located with its Render components | 2 |

---

## Task 1: Self-describing definitions + generic container rendering + integrity test

This task changes the data model and the canvas container rendering **on the current monolithic `lib/registry.ts`**, and adds the integrity test. No files are split yet.

**Files:**
- Modify: `lib/registry-types.ts`, `lib/registry.ts`, `components/editor/EditorBlock.tsx`
- Test: `tests/registry.test.ts`

- [ ] **Step 1: Confirm `createChildren` has only one consumer**

Run: `grep -rn "createChildren" lib components app`
Expected: references only in `lib/registry-types.ts` (the type), `lib/registry.ts` (the `columns` definition + `createBlock`). If any OTHER file uses `def.createChildren`, STOP and report — the plan assumes `createBlock` is the sole consumer.

- [ ] **Step 2: Write the failing integrity test** — `tests/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { REGISTRY, CATEGORIES, createBlock } from "@/lib/registry";

describe("block registry integrity", () => {
  it("every entry's type matches its key and has a Render component", () => {
    for (const [key, def] of Object.entries(REGISTRY)) {
      expect(def.type).toBe(key);
      expect(typeof def.Render).toBe("function");
    }
  });

  it("every CATEGORIES type exists in REGISTRY", () => {
    for (const cat of CATEGORIES) {
      for (const t of cat.types) {
        expect(REGISTRY[t], `category "${cat.name}" lists unknown type "${t}"`).toBeDefined();
      }
    }
  });

  it("every palette block is categorized once (child-only 'column' is intentionally excluded)", () => {
    const categorized = CATEGORIES.flatMap((c) => c.types);
    expect(new Set(categorized).size).toBe(categorized.length); // no duplicates
    for (const type of Object.keys(REGISTRY)) {
      if (type === "column") continue; // created only as a columns child; not in the palette
      expect(categorized.includes(type), `"${type}" is in no category`).toBe(true);
    }
  });

  it("defaultChildren reference real registered types", () => {
    for (const def of Object.values(REGISTRY)) {
      for (const t of def.defaultChildren ?? []) {
        expect(REGISTRY[t], `defaultChildren references unknown "${t}"`).toBeDefined();
      }
    }
  });

  it("containerStrategy, when set, is a known value", () => {
    for (const def of Object.values(REGISTRY)) {
      if (def.containerStrategy !== undefined) {
        expect(["slotted", "fixed"]).toContain(def.containerStrategy);
      }
    }
  });

  it("createBlock builds a columns block with two column children", () => {
    const b = createBlock("columns");
    expect(b.type).toBe("columns");
    expect(b.children).toHaveLength(2);
    expect(b.children.every((c) => c.type === "column")).toBe(true);
    expect(b.children[0].id).not.toBe(b.children[1].id); // fresh ids
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run tests/registry.test.ts`): the `defaultChildren`/`createBlock` columns test fails because `columns` still uses `createChildren` (and `defaultChildren` is undefined). The others may pass already.

- [ ] **Step 4: Update `lib/registry-types.ts`**

Remove the `createChildren` field:

```ts
  /** default children created on instantiation (e.g. columns -> N columns) */
  createChildren?: () => Block[];
```

Replace it with:

```ts
  /** block types instantiated as children on creation (e.g. columns -> ["column","column"]) */
  defaultChildren?: string[];
  /** how the editor canvas renders this container's children:
   *  "slotted" (default) = drop-zone slots; "fixed" = children mapped directly (e.g. columns) */
  containerStrategy?: "slotted" | "fixed";
  /** min height (px) of the empty drop zone for a slotted container */
  emptyMinHeight?: number;
```

(`Block` is still imported/used by `BlockRenderProps` and `CustomContent` — leave that import.)

- [ ] **Step 5: Update `lib/registry.ts`**

(a) In the `columns` definition, replace:
```ts
    Render: ColumnsBlock,
    createChildren: () => [createBlock("column"), createBlock("column")],
```
with:
```ts
    Render: ColumnsBlock,
    containerStrategy: "fixed",
    defaultChildren: ["column", "column"],
```

(b) In the `column` definition, add `emptyMinHeight: 64` (any position among its props), e.g. after `isContainer: true,`:
```ts
    isContainer: true,
    emptyMinHeight: 64,
```

(c) In the `section` definition, add `emptyMinHeight: 80` after `isContainer: true,`:
```ts
    isContainer: true,
    emptyMinHeight: 80,
```

(d) Update `createBlock` to resolve `defaultChildren`:
```ts
export function createBlock(type: string): Block {
  const def = REGISTRY[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return {
    id: uid(),
    type,
    props: JSON.parse(JSON.stringify(def.defaultProps ?? {})),
    styles: JSON.parse(JSON.stringify(def.defaultStyles ?? {})),
    children: (def.defaultChildren ?? []).map((t) => createBlock(t)),
  };
}
```

- [ ] **Step 6: Make `EditorBlock` render containers generically**

In `components/editor/EditorBlock.tsx`, replace the `columns` special-case block (currently):
```tsx
    let children: ReactNode = undefined;
    if (def!.type === "columns") {
      children = block.children.map((c, i) => (
        <EditorBlock key={c.id} block={c} parentId={block.id} parentType="columns" index={i} />
      ));
    } else if (def!.isContainer) {
      children = (
        <SlottedChildren
          parentId={block.id}
          parentType={block.type}
          items={block.children}
          emptyMinHeight={block.type === "column" ? 64 : 80}
        />
      );
    }
```
with:
```tsx
    let children: ReactNode = undefined;
    if (def!.isContainer) {
      children =
        def!.containerStrategy === "fixed"
          ? block.children.map((c, i) => (
              <EditorBlock key={c.id} block={c} parentId={block.id} parentType={block.type} index={i} />
            ))
          : (
              <SlottedChildren
                parentId={block.id}
                parentType={block.type}
                items={block.children}
                emptyMinHeight={def!.emptyMinHeight}
              />
            );
    }
```
(Behavior preserved: `columns` → `"fixed"` → direct map with `parentType="columns"`; `column` → slotted, `emptyMinHeight=64`; `section` → slotted, `emptyMinHeight=80`. `SlottedChildren.emptyMinHeight` is already optional.)

- [ ] **Step 7: Run the integrity test + full verification**

Run: `npx vitest run tests/registry.test.ts` → PASS (6 tests).
Run: `npx tsc --noEmit` → clean (the removed `createChildren` type is gone; nothing else references it per Step 1).
Run: `npm test` → all pass (102 prior + 6 new = 108).
Run: `npm run build` → succeeds.

- [ ] **Step 8: Manual smoke** (in `npm run dev`): insert a Columns block → it still creates 2 columns; dropping blocks into a column still works; the empty section/column drop zones still show. Insert a Section → drop zone present.

- [ ] **Step 9: Commit**

```bash
git add lib/registry-types.ts lib/registry.ts components/editor/EditorBlock.tsx tests/registry.test.ts
git commit -m "refactor(blocks): data-driven children + container strategy + integrity test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Co-locate definitions and slim `registry.ts` to a collector

Move each block's `BlockDefinition` out of `lib/registry.ts` into its existing co-located component file as an exported array, and rewrite `lib/registry.ts` as a thin collector. The integrity test from Task 1 + `tsc` + `build` are the safety net.

> **This is a behavior-preserving code MOVE.** The definition objects already exist verbatim in `lib/registry.ts`; move each one unchanged (every `type`/`label`/`icon`/`defaultProps`/`defaultStyles`/`fields`/`styleGroups`/`Render`/etc. preserved exactly). Do not rewrite or "improve" any definition's contents. Only their location and the surrounding imports change.

**Definition → destination file (and the array export name):**

| Component file | Block types to move there (in this order) | Export |
|----------------|-------------------------------------------|--------|
| `components/blocks/layout.tsx` | section, columns, column, spacer, divider | `export const layoutBlocks: BlockDefinition[]` |
| `components/blocks/basic.tsx` | heading, text, button, image, icon, video, list, quote | `export const basicBlocks: BlockDefinition[]` |
| `components/blocks/embed.tsx` | embed, code | `export const embedBlocks: BlockDefinition[]` |
| `components/blocks/file.tsx` | file | `export const fileBlocks: BlockDefinition[]` |
| `components/blocks/navbar.tsx` | navbar | `export const navbarBlocks: BlockDefinition[]` |
| `components/blocks/form.tsx` | form | `export const formBlocks: BlockDefinition[]` |
| `components/blocks/sections.tsx` | hero, features, pricing, testimonial, stats, cta, footer | `export const sectionBlocks: BlockDefinition[]` |
| `components/blocks/collection.tsx` | collection | `export const collectionBlocks: BlockDefinition[]` |

**Files:**
- Modify: all 8 block files above, `components/blocks/shared.tsx`, `lib/registry.ts`

- [ ] **Step 1: Export shared `ALIGN_OPTIONS` from `components/blocks/shared.tsx`**

`ALIGN_OPTIONS` (currently top of `lib/registry.ts`) is used by `button`, `icon`, `file`, and `hero` definitions — which land in three different files. Add it to the existing shared module:

```ts
// components/blocks/shared.tsx
export const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];
```

- [ ] **Step 2: Move definitions into each block file**

For EACH file in the table: add an exported `BlockDefinition[]` array containing that file's block definitions (moved verbatim from `lib/registry.ts`), and add the imports those definitions need at the top of the file:
- `import type { BlockDefinition } from "@/lib/registry-types";`
- the lucide icons each definition uses (move them from `lib/registry.ts`'s import — e.g. `Heading, Type, MousePointerClick, Image as ImageIcon, Star, Video as VideoIcon, List as ListIcon, Quote as QuoteIcon` for `basic.tsx`),
- `import { ALIGN_OPTIONS } from "./shared";` where a definition uses it (`basic.tsx` for button/icon, `file.tsx`, `sections.tsx` for hero),
- the Render component is already in the file (it's the co-located component) — reference it directly instead of importing it.
- `collection.tsx` additionally keeps `CustomContent: CollectionInspector` — add `import { CollectionInspector } from "@/components/editor/CollectionInspector";` there (verify with `tsc` this introduces no cycle; if it does, STOP and report).

Each definition object's CONTENTS stay byte-for-byte identical (including the Task-1 additions: `columns` has `containerStrategy: "fixed"` + `defaultChildren: ["column","column"]`; `column` has `emptyMinHeight: 64`; `section` has `emptyMinHeight: 80`).

- [ ] **Step 3: Rewrite `lib/registry.ts` as the collector**

Replace the whole file with:

```ts
import type { Block, BlockCategory } from "./types";
import type { BlockDefinition } from "./registry-types";
import { uid } from "./utils";

import { layoutBlocks } from "@/components/blocks/layout";
import { basicBlocks } from "@/components/blocks/basic";
import { embedBlocks } from "@/components/blocks/embed";
import { fileBlocks } from "@/components/blocks/file";
import { navbarBlocks } from "@/components/blocks/navbar";
import { formBlocks } from "@/components/blocks/form";
import { sectionBlocks } from "@/components/blocks/sections";
import { collectionBlocks } from "@/components/blocks/collection";

const ALL_BLOCKS: BlockDefinition[] = [
  ...layoutBlocks,
  ...basicBlocks,
  ...embedBlocks,
  ...fileBlocks,
  ...navbarBlocks,
  ...formBlocks,
  ...sectionBlocks,
  ...collectionBlocks,
];

export const REGISTRY: Record<string, BlockDefinition> = Object.fromEntries(
  ALL_BLOCKS.map((def) => [def.type, def]),
);

// Palette grouping + ORDER (intentionally explicit — the palette order is not the
// definition order, and the child-only "column" block is omitted on purpose).
export const CATEGORIES: { name: BlockCategory; types: string[] }[] = [
  { name: "Layout", types: ["section", "columns", "spacer", "divider"] },
  { name: "Basic", types: ["heading", "text", "button", "image", "icon", "video", "list", "quote", "file", "embed", "code"] },
  { name: "Sections", types: ["navbar", "hero", "features", "pricing", "testimonial", "stats", "cta", "form", "footer"] },
  { name: "Dynamic", types: ["collection"] },
];

export function getDefinition(type: string): BlockDefinition | undefined {
  return REGISTRY[type];
}

/** Build a synced component-instance block (not in the registry). */
export function createComponentInstance(componentId: string): Block {
  return {
    id: uid(),
    type: "component",
    props: { componentId },
    styles: {},
    children: [],
  };
}

/** Build a fresh block instance from its registry definition. */
export function createBlock(type: string): Block {
  const def = REGISTRY[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return {
    id: uid(),
    type,
    props: JSON.parse(JSON.stringify(def.defaultProps ?? {})),
    styles: JSON.parse(JSON.stringify(def.defaultStyles ?? {})),
    children: (def.defaultChildren ?? []).map((t) => createBlock(t)),
  };
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean. Fix import errors (unused lucide imports left behind, missing imports in the block files). If `tsc` reports a circular-import type error involving `collection.tsx`/`CollectionInspector`, STOP and report.

Run: `npm test` → all pass (108). The integrity test from Task 1 now confirms the split preserved every type, category, Render, and the columns children.

Run: `npm run build` → succeeds (all block types still render).

Run: `grep -n "REGISTRY = {" lib/registry.ts` → nothing (the giant literal is gone; `REGISTRY` is now assembled via `Object.fromEntries`).

- [ ] **Step 5: Manual smoke** (in `npm run dev`): open the block palette → all categories and blocks appear in the same order; insert one block from each category → renders correctly; Columns still seeds 2 columns.

- [ ] **Step 6: Commit**

```bash
git add components/blocks lib/registry.ts
git commit -m "refactor(blocks): co-locate definitions; registry.ts becomes a collector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist (run before declaring done)

- [ ] **Spec coverage:** `defaultChildren` + `containerStrategy` + `emptyMinHeight` on `BlockDefinition` (Task 1); `EditorBlock` generic (Task 1); integrity test (Task 1); definitions co-located + `registry.ts` is a collector (Task 2).
- [ ] **No cycle:** the 8 block definition files import NOTHING from `@/lib/registry` (`grep -rn "@/lib/registry\"" components/blocks` → empty). The dependency is one-way: `registry → blocks`.
- [ ] **Behavior preserved:** every definition moved verbatim; `CATEGORIES` order unchanged; `createBlock("columns")` → 2 columns; container drop zones unchanged; palette order identical.
- [ ] **Name consistency:** `defaultChildren`, `containerStrategy`, `emptyMinHeight`, `layoutBlocks`/`basicBlocks`/`embedBlocks`/`fileBlocks`/`navbarBlocks`/`formBlocks`/`sectionBlocks`/`collectionBlocks`, `REGISTRY`, `CATEGORIES`, `createBlock`.
- [ ] `npx tsc --noEmit && npm test && npm run build` all green (108 tests).

---

## Deferred / not in this plan
- Removing the now-explicit `CATEGORIES` in favor of derivation — kept explicit because palette order ≠ definition order and `column` is intentionally excluded; the integrity test guards drift instead.
- Per-block dynamic import / lazy registration (code-splitting the block bundle) — out of scope.
