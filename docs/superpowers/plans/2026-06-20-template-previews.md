# Template Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a real, scaled-down live preview of each template inside the "Choose a starting point" modal, so users can see what each starting point looks like before picking.

**Architecture:** A new focused `TemplatePreview` component renders a template's block tree through the existing shared `BlockRenderer` (the same renderer used by published pages) at a fixed desktop width, then shrinks it with a CSS `transform: scale()` inside a clipped, fixed-aspect box. The template chooser modal (`TemplateModal` in `Dashboard.tsx`) places that preview on top of each card. Because rendered templates contain their own buttons/links, the card changes from a `<button>` to a `<div>` with a transparent overlay `<button>` for the click (preview is `pointer-events-none`).

**Tech Stack:** Next 16, React 19, Tailwind v4, framer-motion, the existing `@/components/BlockRenderer`, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-20-template-previews-design.md`

**Gate (run after each task):** `npx tsc --noEmit` (expect ONLY the 2 pre-existing `components/editor/Canvas.tsx` errors) and `npm test`. Never run `next build` (clobbers the live dev server).

---

## File Structure

**Create:**
- `components/dashboard/TemplatePreview.tsx` — renders one template's blocks as a scaled, clipped, non-interactive thumbnail (or an empty-canvas placeholder when the tree is empty).
- `tests/template-preview.dom.test.tsx` — dom test: real content renders for a template; placeholder renders for an empty tree.

**Modify:**
- `components/dashboard/Dashboard.tsx` — `TemplateModal`: add the preview to each card, restructure the card (`button` → `div` + overlay `button`), widen the modal, build template trees once via `useMemo`.

---

## Task 1: TemplatePreview component

**Files:**
- Create: `components/dashboard/TemplatePreview.tsx`
- Test: `tests/template-preview.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/template-preview.dom.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplatePreview } from "@/components/dashboard/TemplatePreview";
import { TEMPLATES } from "@/lib/blocks/templates";

describe("TemplatePreview", () => {
  it("renders the real blocks of a template (landing hero title)", () => {
    const landing = TEMPLATES.find((t) => t.id === "landing")!;
    render(<TemplatePreview blocks={landing.build()} />);
    expect(screen.getByText("Ship beautiful pages in minutes")).toBeInTheDocument();
  });

  it("shows the empty-canvas placeholder for a blank template", () => {
    render(<TemplatePreview blocks={[]} />);
    expect(screen.getByText("Empty canvas")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/template-preview.dom.test.tsx`
Expected: FAIL — `Cannot find module '@/components/dashboard/TemplatePreview'`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/dashboard/TemplatePreview.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BlockRenderer } from "@/components/BlockRenderer";
import type { Block } from "@/lib/types";

// Render the template at a real desktop width, then scale the whole stage down
// to fit the card. A fixed width keeps responsive (`md:`) utilities resolving as
// "desktop", which is what these thumbnails should show.
const STAGE_WIDTH = 1280;

/**
 * A scaled, non-interactive thumbnail of a single template's page. Reuses the
 * shared BlockRenderer (same output as the published page) with animations off
 * and styles inlined, so the preview is self-contained — no global CSS, no
 * leakage into the surrounding modal. An empty tree renders a placeholder.
 */
export function TemplatePreview({ blocks }: { blocks: Block[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const measure = () => setWidth(boxRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (blocks.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
        <Plus size={20} />
        <span className="text-[11px] font-medium">Empty canvas</span>
      </div>
    );
  }

  const scale = width ? width / STAGE_WIDTH : 0;

  return (
    <div
      ref={boxRef}
      className="pointer-events-none aspect-[16/10] w-full overflow-hidden rounded-lg border border-zinc-200 bg-white"
    >
      <div style={{ width: STAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <BlockRenderer
          tree={blocks}
          viewport="desktop"
          animate={false}
          inlineStyles
          components={{}}
          collections={{}}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/template-preview.dom.test.tsx`
Expected: PASS (2 tests). In jsdom the measured width is 0 so `scale` is 0, but `BlockRenderer` still mounts the template into the DOM, so `getByText` finds the hero title.

Then run: `npx tsc --noEmit`
Expected: only the 2 pre-existing `components/editor/Canvas.tsx` errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/TemplatePreview.tsx tests/template-preview.dom.test.tsx
git commit -m "feat(dashboard): TemplatePreview — scaled live thumbnail of a template"
```

---

## Task 2: Wire previews into the template chooser modal

**Files:**
- Modify: `components/dashboard/Dashboard.tsx` (the `TemplateModal` function, currently at ~`335-366`, and its React import).

- [ ] **Step 1: Add imports**

In `components/dashboard/Dashboard.tsx`, update the React import to include `useMemo`. The current import is:

```tsx
import { useEffect, useState } from "react";
```

Change it to:

```tsx
import { useEffect, useMemo, useState } from "react";
```

Then add the `TemplatePreview` import alongside the other local imports (near the `PageCard`/`SubmissionsModal` imports):

```tsx
import { TemplatePreview } from "./TemplatePreview";
```

- [ ] **Step 2: Replace the `TemplateModal` body**

Replace the entire current `TemplateModal` function (the one rendering `<Modal open={open} ... className="max-w-2xl p-6">` with the `TEMPLATES.map` of `motion.button` cards) with this version. Changes: builds the trees once via `useMemo`; widens the modal to `max-w-3xl`; each card is now a `motion.div` with the `TemplatePreview` on top, the name/description below, and a transparent overlay `<button>` that carries the click + disabled state (so the template's own buttons/links are never nested inside a `<button>`).

```tsx
function TemplateModal({
  open,
  creating,
  onClose,
  onPick,
}: {
  open: boolean;
  creating: string | null;
  onClose: () => void;
  onPick: (t: Template) => void;
}) {
  // Build each template's block tree once (build() mints fresh ids each call).
  const built = useMemo(() => TEMPLATES.map((t) => ({ template: t, blocks: t.build() })), []);

  return (
    <Modal open={open} onClose={onClose} dismissible={!creating} className="max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Choose a starting point</h2>
          <p className="text-sm text-zinc-500">Pick a template or start from scratch.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onPress={onClose}><X size={18} /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {built.map(({ template: t, blocks }) => (
          <motion.div
            key={t.id}
            whileHover={creating ? undefined : { y: -2 }}
            whileTap={creating ? undefined : { scale: 0.98 }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 text-left shadow-xs transition-colors hover:border-indigo-300",
              creating && "opacity-60",
            )}
          >
            <TemplatePreview blocks={blocks} />
            <div className="flex flex-col gap-1 p-4">
              <span className="font-semibold tracking-tight text-zinc-900 group-hover:text-indigo-700">{t.name}</span>
              <span className="text-xs leading-snug text-zinc-500">{t.description}</span>
            </div>
            <button
              type="button"
              aria-label={`Use ${t.name} template`}
              disabled={!!creating}
              onClick={() => onPick(t)}
              className="absolute inset-0 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed"
            />
            {creating === t.id && (
              <span className="absolute right-3 top-3">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Verify `cn` is imported**

The new card uses `cn`. Confirm `components/dashboard/Dashboard.tsx` imports it; if not present, add:

```tsx
import { cn } from "@/lib/utils";
```

Run: `grep -n "cn" components/dashboard/Dashboard.tsx` — confirm an `import { cn }` (or `cn,`) line exists. If the grep shows `cn` used but never imported, add the import above.

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc --noEmit`
Expected: only the 2 pre-existing `components/editor/Canvas.tsx` errors. (A common slip: leaving `disabled`/`onClick` on a `motion.div` — those belong on the overlay `<button>`. If tsc complains about `disabled` on `motion.div`, you left it on the wrong element.)

Run: `npm test`
Expected: all pass (the Task 1 tests + the existing suite), no regressions.

- [ ] **Step 5: Manual visual check (the modal isn't unit-tested — it needs editor/router context)**

With the dev server running, open the dashboard, click **New page**, and confirm:
- Each non-blank card shows a real, scaled page preview (Landing/SaaS/Portfolio look distinct — gradients/colors visible).
- The **Blank** card shows the dashed "Empty canvas" placeholder.
- Clicking a card still creates the page (the overlay button works); the per-card spinner still appears while creating; Esc/close still work.
- No console warning about `<button>` nested in `<button>` (proves the overlay restructure worked).

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): show live template previews in the chooser modal"
```

---

## Self-Review

**Spec coverage:**
- Live mini-render via `BlockRenderer` (`animate=false`, `inlineStyles=true`, empty components/collections) → Task 1, Step 3 ✓
- Fixed 1280px stage + `transform: scale()` + clipped fixed-aspect box, `pointer-events-none` → Task 1, Step 3 ✓
- Blank → empty-canvas placeholder (dashed + Plus + label) → Task 1, Step 3 ✓
- Modal: preview on top, name/description below, handlers/spinner unchanged, widened to `max-w-3xl` → Task 2, Step 2 ✓
- Build trees once (perf) → Task 2 `useMemo` ✓
- Test: landing hero title renders; blank shows placeholder → Task 1, Step 1 ✓
- Boundary (chooser-only; not in published path) → `TemplatePreview` lives in `components/dashboard/`, imported only by the modal ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. The one non-automated check (Task 2 Step 5) is explicitly justified — the modal is internal to `Dashboard.tsx` and needs router/editor context, so it's a manual visual check, not a vague "test it".

**Type consistency:** `TemplatePreview` takes `{ blocks: Block[] }` in Task 1 and is called as `<TemplatePreview blocks={blocks} />` in Task 2. `built` items are `{ template, blocks }` and destructured as `{ template: t, blocks }`. `BlockRenderer` props (`tree`/`viewport`/`animate`/`inlineStyles`/`components`/`collections`) match its real signature in `components/BlockRenderer.tsx:121`. `Template` type and `TEMPLATES` come from `@/lib/blocks/templates` (already imported in `Dashboard.tsx`).
