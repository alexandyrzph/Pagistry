# Blueprint Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the app shell and rebuild the index page into the reference's "blueprint" aesthetic — off-white paper, ink type, indigo accent, monospace metadata, 16:10 cards (real screenshots) with status pills + hover-reveal actions, a segmented All/Live/Drafts filter, and a "New blank page" tile.

**Architecture:** Pure visual reskin over existing wiring. The shared sidebar is restyled (applies app-wide). The index page (`Dashboard.tsx`) is decomposed into `PageCard` + `SegmentedFilter` with a pure `filterPages` helper; `PageThumbnail` is reframed to fill a 16:10 card. No data-layer, routing, or screenshot-pipeline changes.

**Tech Stack:** Next.js 16, Tailwind v4 (`@theme inline`, arbitrary hex values), Geist + Geist Mono, framer-motion, lucide-react, Vitest (node + jsdom).

---

## Design tokens (reference hexes, used as Tailwind arbitrary values)

paper `#f7f8fa` · surface `#fff` · hairline `#e8eaed` · inset `#f1f3f5` · ink `#111827` · secondary `#4b5563`/`#6b7280` · muted `#9aa1ac`/`#aeb4bd` · accent **indigo-600** · live `emerald-600`/`emerald-500`.

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `app/globals.css` | add `--font-mono` (Geist Mono) | Modify |
| `app/(app)/layout.tsx` | paper background | Modify |
| `lib/dashboard/filter.ts` | pure `filterPages` + `DashboardFilter` | Create |
| `components/dashboard/SegmentedFilter.tsx` | All/Live/Drafts control | Create |
| `components/dashboard/PageThumbnail.tsx` | fill 16:10 + neutral fallback (drop `gradient`) | Modify |
| `components/dashboard/PageCard.tsx` | card: thumb frame, pill, hover actions, meta | Create |
| `components/dashboard/Dashboard.tsx` | orchestrator: header, toolbar, grid, tile | Modify |
| `components/app-shell/Sidebar.tsx` | blueprint reskin | Modify |
| `components/app-shell/WorkspaceSwitcher.tsx` | solid indigo avatar + mono plan | Modify |
| `components/app-shell/SidebarProfile.tsx` | ink avatar | Modify |
| `tests/dashboard-filter.test.ts` | unit | Create |
| `tests/page-thumbnail.dom.test.tsx` | update for neutral fallback | Modify |
| `tests/page-card.dom.test.tsx` | Live/Draft pill + view-live link | Create |

**Gate:** `npx tsc --noEmit` + `npm test`. Never run `next build`.

**Sequencing note:** Task 4 changes `PageThumbnail`'s props/layout, so it also patches the one current caller (the card in `Dashboard.tsx`) to keep the project compiling and the page coherent. Task 8 (the full Dashboard rebuild) then supersedes that patch.

---

### Task 1: Foundation — mono font + paper background

**Files:**
- Modify: `app/globals.css` (the `@theme inline` block, lines 3-6)
- Modify: `app/(app)/layout.tsx:28`

- [ ] **Step 1: Add the mono font variable**

In `app/globals.css`, replace the `@theme inline { ... }` block (currently only `--font-sans`) with:

```css
@theme inline {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system,
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

- [ ] **Step 2: Switch the app background to paper**

In `app/(app)/layout.tsx`, change the wrapper div's class:

```tsx
    <div className="flex min-h-screen w-full flex-col bg-[#f7f8fa] md:flex-row">
```

(Only `bg-zinc-50` → `bg-[#f7f8fa]`; everything else unchanged.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no output).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/(app)/layout.tsx
git commit -m "feat(ui): paper background + Geist Mono token for blueprint redesign"
```

---

### Task 2: Pure page filter (TDD)

**Files:**
- Create: `lib/dashboard/filter.ts`
- Test: `tests/dashboard-filter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard-filter.test.ts
import { describe, it, expect } from "vitest";
import { filterPages } from "@/lib/dashboard/filter";

const pages = [
  { title: "Portfolio", slug: "portfolio", published: true },
  { title: "Acme Landing", slug: "acme-landing", published: true },
  { title: "Untitled Page", slug: "untitled-page", published: false },
];

describe("filterPages", () => {
  it("returns all pages when query empty and filter is all", () => {
    expect(filterPages(pages, "", "all")).toHaveLength(3);
  });
  it("matches by title, case-insensitively", () => {
    expect(filterPages(pages, "port", "all").map((p) => p.slug)).toEqual(["portfolio"]);
    expect(filterPages(pages, "ACME", "all").map((p) => p.slug)).toEqual(["acme-landing"]);
  });
  it("matches by slug", () => {
    expect(filterPages(pages, "untitled", "all").map((p) => p.slug)).toEqual(["untitled-page"]);
  });
  it("filters live and drafts", () => {
    expect(filterPages(pages, "", "live").map((p) => p.slug)).toEqual(["portfolio", "acme-landing"]);
    expect(filterPages(pages, "", "drafts").map((p) => p.slug)).toEqual(["untitled-page"]);
  });
  it("combines query and filter", () => {
    expect(filterPages(pages, "a", "live").map((p) => p.slug)).toEqual(["acme-landing"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-filter.test.ts`
Expected: FAIL — cannot resolve `@/lib/dashboard/filter`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/dashboard/filter.ts

export type DashboardFilter = "all" | "live" | "drafts";

type FilterablePage = { title: string; slug: string; published: boolean };

/** Filter pages by a search query (title or slug, case-insensitive) and a
 *  status filter (all | live | drafts). Pure — safe to unit test. */
export function filterPages<T extends FilterablePage>(
  pages: T[],
  query: string,
  filter: DashboardFilter,
): T[] {
  const q = query.trim().toLowerCase();
  return pages.filter((p) => {
    const matchQ =
      !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    const matchF =
      filter === "all" ||
      (filter === "live" && p.published) ||
      (filter === "drafts" && !p.published);
    return matchQ && matchF;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-filter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/filter.ts tests/dashboard-filter.test.ts
git commit -m "feat(dashboard): pure filterPages (search + live/drafts)"
```

---

### Task 3: SegmentedFilter control

**Files:**
- Create: `components/dashboard/SegmentedFilter.tsx`

> Presentational; verified by `tsc` and reused in Task 8 (consistent with the codebase, which doesn't unit-test pure presentational components).

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/SegmentedFilter.tsx
"use client";

import { cn } from "@/lib/utils";
import type { DashboardFilter } from "@/lib/dashboard/filter";

export function SegmentedFilter({
  value,
  onChange,
  counts,
}: {
  value: DashboardFilter;
  onChange: (f: DashboardFilter) => void;
  counts: { all: number; live: number; drafts: number };
}) {
  const tabs: { k: DashboardFilter; label: string }[] = [
    { k: "all", label: `All ${counts.all}` },
    { k: "live", label: `Live ${counts.live}` },
    { k: "drafts", label: `Drafts ${counts.drafts}` },
  ];
  return (
    <div className="flex gap-1 rounded-[10px] bg-[#f1f3f5] p-[3px]">
      {tabs.map((t) => (
        <button
          key={t.k}
          onClick={() => onChange(t.k)}
          className={cn(
            "rounded-[7px] px-3.5 py-1.5 text-[13px] transition-colors",
            value === t.k
              ? "bg-white font-semibold text-[#111827] shadow-xs"
              : "font-medium text-[#6b7280] hover:text-[#111827]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/SegmentedFilter.tsx
git commit -m "feat(dashboard): SegmentedFilter All/Live/Drafts control"
```

---

### Task 4: Reframe PageThumbnail (fill 16:10, neutral fallback)

**Files:**
- Modify: `components/dashboard/PageThumbnail.tsx` (full replace)
- Modify: `tests/page-thumbnail.dom.test.tsx` (full replace)
- Modify: `components/dashboard/Dashboard.tsx` (patch the current card usage so the project keeps compiling — superseded in Task 8)

- [ ] **Step 1: Update the dom test first (TDD)**

Replace the entire contents of `tests/page-thumbnail.dom.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageThumbnail } from "@/components/dashboard/PageThumbnail";

describe("PageThumbnail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network in test"))));
  });

  it("shows the cached image (cache-busted) when one exists and it is fresh", () => {
    render(
      <PageThumbnail pageId="p1" title="Portfolio" initialUrl="/uploads/thumbnails/p1.png" version={42} stale={false} />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe("/uploads/thumbnails/p1.png?v=42");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a neutral placeholder (no image) when there is none", () => {
    render(<PageThumbnail pageId="p2" title="acme landing" initialUrl={null} version={null} stale={false} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/page-thumbnail.dom.test.tsx`
Expected: FAIL — the current component still requires a `gradient` prop (TS error in the test) and/or renders the letter fallback.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `components/dashboard/PageThumbnail.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { createLimiter } from "@/lib/thumbnails/queue";

// Shared across all cards: at most 2 screenshot requests in flight at once.
const limiter = createLimiter(2);

export function PageThumbnail({
  pageId,
  title,
  initialUrl,
  version,
  stale,
}: {
  pageId: string;
  title: string;
  initialUrl: string | null;
  version: number | null;
  stale: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [v, setV] = useState(version);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    setLoading(true);
    limiter(() =>
      fetch(`/api/pages/${pageId}/thumbnail`, { method: "POST" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    )
      .then((d: { url?: string; version?: number } | null) => {
        if (d?.url) {
          setUrl(d.url);
          setV(d.version ?? null);
        }
      })
      .catch(() => {
        /* keep last image / placeholder — never break the dashboard */
      })
      .finally(() => setLoading(false));
  }, [stale, pageId]);

  const src = url ? `${url}?v=${v ?? 0}` : null;

  return (
    <div className="absolute inset-0 bg-[#fbfbfc]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#cdd2d8]">
          <FileText size={22} strokeWidth={1.5} />
        </div>
      )}
      {loading && <div className="absolute inset-0 animate-pulse bg-zinc-900/[0.04]" />}
    </div>
  );
}
```

- [ ] **Step 4: Patch the current caller in `Dashboard.tsx` so it still compiles**

In `components/dashboard/Dashboard.tsx`, find the card thumbnail block (currently a `<Link href={`/editor/${p.id}`} className="block">` wrapping `<div className="relative">` with `<PageThumbnail ... gradient={GRADIENTS[i % GRADIENTS.length]} ... />`). Make two minimal edits:
  1. Change `<div className="relative">` to `<div className="relative aspect-[16/10]">`.
  2. Remove the `gradient={GRADIENTS[i % GRADIENTS.length]}` prop from the `<PageThumbnail .../>` call.

Leave everything else in `Dashboard.tsx` as-is for now (the `GRADIENTS` constant becomes unused but that does not fail `tsc`; it is removed in Task 8).

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/page-thumbnail.dom.test.tsx && npx tsc --noEmit`
Expected: tests PASS (2); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/PageThumbnail.tsx tests/page-thumbnail.dom.test.tsx components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): reframe PageThumbnail to fill 16:10 with neutral fallback"
```

---

### Task 5: PageCard component (TDD)

**Files:**
- Create: `components/dashboard/PageCard.tsx`
- Test: `tests/page-card.dom.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/page-card.dom.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageCard, type DashboardPage } from "@/components/dashboard/PageCard";

const base: DashboardPage = {
  id: "p1",
  title: "Portfolio",
  slug: "portfolio",
  published: true,
  updatedAt: new Date("2026-06-16T12:00:00Z").toISOString(),
  submissions: 0,
  thumbnailUrl: "/uploads/thumbnails/p1.png",
  thumbnailVersion: 1,
  thumbnailStale: false,
};

describe("PageCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no net"))));
  });

  it("shows a Live pill and a view-live link for a published page", () => {
    const { container } = render(
      <PageCard page={base} index={0} deleting={false} onOpenSubmissions={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(container.querySelector('a[href="/p/portfolio"]')).not.toBeNull();
  });

  it("shows a Draft pill and no view-live link for an unpublished page", () => {
    const draft: DashboardPage = { ...base, id: "p2", slug: "draft-x", published: false };
    const { container } = render(
      <PageCard page={draft} index={0} deleting={false} onOpenSubmissions={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(container.querySelector('a[href="/p/draft-x"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/page-card.dom.test.tsx`
Expected: FAIL — cannot resolve `@/components/dashboard/PageCard`.

- [ ] **Step 3: Write the component**

```tsx
// components/dashboard/PageCard.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Inbox, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageThumbnail } from "./PageThumbnail";

export type DashboardPage = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  submissions: number;
  thumbnailUrl: string | null;
  thumbnailVersion: number | null;
  thumbnailStale: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function IconBtn({
  label,
  danger,
  disabled,
  onClick,
  href,
  external,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "grid h-7 w-7 place-items-center rounded-[7px] border border-transparent text-[#9aa1ac] transition-colors",
    danger
      ? "hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      : "hover:border-[#d6dae0] hover:bg-white hover:text-[#111827]",
    disabled && "pointer-events-none opacity-40",
  );
  if (href) {
    return (
      <Link href={href} title={label} className={cls} {...(external ? { target: "_blank" } : {})}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" title={label} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function PageCard({
  page,
  index,
  deleting,
  onOpenSubmissions,
  onDelete,
}: {
  page: DashboardPage;
  index: number;
  deleting: boolean;
  onOpenSubmissions: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3, ease: "easeOut" }}
      className="group overflow-hidden rounded-[14px] border border-[#e8eaed] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d6dae0] hover:shadow-lg"
    >
      {/* thumbnail */}
      <Link href={`/editor/${page.id}`} className="relative block aspect-[16/10] border-b border-[#eef0f2]">
        <PageThumbnail
          pageId={page.id}
          title={page.title}
          initialUrl={page.thumbnailUrl}
          version={page.thumbnailVersion}
          stale={page.thumbnailStale}
        />
        <span
          className={cn(
            "absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
            page.published ? "bg-emerald-600/10 text-emerald-700" : "bg-zinc-400/10 text-zinc-500",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", page.published ? "bg-emerald-500" : "bg-zinc-400")} />
          {page.published ? "Live" : "Draft"}
        </span>
        <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-zinc-900/[0.04] opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white">
            <Pencil size={13} /> Open editor
          </span>
        </span>
      </Link>

      {/* meta */}
      <div className="flex items-start justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <Link href={`/editor/${page.id}`}>
            <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-[#111827] transition-colors hover:text-indigo-600">
              {page.title}
            </h3>
          </Link>
          <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11.5px] text-[#9aa1ac]">
            <span className="truncate">/{page.slug}</span>
            <span className="text-[#d6dae0]">·</span>
            <span className="whitespace-nowrap">{timeAgo(page.updatedAt)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="relative">
            <IconBtn label="Submissions" onClick={onOpenSubmissions}>
              <Inbox size={15} />
            </IconBtn>
            {page.submissions > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                {page.submissions}
              </span>
            )}
          </div>
          {page.published && (
            <IconBtn label="View live" href={`/p/${page.slug}`} external>
              <ExternalLink size={15} />
            </IconBtn>
          )}
          <IconBtn label="Edit" href={`/editor/${page.id}`}>
            <Pencil size={15} />
          </IconBtn>
          <IconBtn label="Delete" danger disabled={deleting} onClick={onDelete}>
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </IconBtn>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/page-card.dom.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PageCard.tsx tests/page-card.dom.test.tsx
git commit -m "feat(dashboard): PageCard with status pill + hover-reveal actions"
```

---

### Task 6: Sidebar blueprint reskin

**Files:**
- Modify: `components/app-shell/Sidebar.tsx` (full replace — logic identical, styling only)

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/app-shell/Sidebar.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, Menu, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";
import { setSidebarCookie } from "./SidebarToggleCookie";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SidebarProfile } from "./SidebarProfile";
import { CommandPalette } from "./CommandPalette";

type WS = { id: string; name: string; slug: string; role: string };

export function Sidebar({
  collapsed: initialCollapsed, workspaces, activeWorkspaceId, role, user,
}: {
  collapsed: boolean; workspaces: WS[]; activeWorkspaceId: string; role: string;
  user: { name: string; email: string };
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => { setCollapsed((c) => { setSidebarCookie(!c); return !c; }); };
  const w = collapsed ? "w-[68px]" : "w-64";
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  const rail = (
    <div className={cn("flex h-full flex-col border-r border-[#e8eaed] bg-white text-[#4b5563] transition-[width] duration-200", w)}>
      <div className="flex items-center gap-2 px-3 py-3.5">
        <WorkspaceSwitcher collapsed={collapsed} workspaces={workspaces} activeId={active?.id} />
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={() => setPaletteOpen(true)}
          title={collapsed ? "Search (⌘K)" : undefined}
          className={cn("flex w-full items-center gap-2.5 rounded-[9px] bg-[#f1f3f5] px-2.5 py-2 text-sm text-[#9aa1ac] transition-colors hover:bg-[#e9ecef]", collapsed && "justify-center bg-transparent hover:bg-[#f1f3f5]")}
        >
          <Search size={16} />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && <kbd className="rounded-[5px] border border-[#d6dae0] bg-[#fbfbfc] px-1.5 py-0.5 font-mono text-[10.5px] text-[#9aa1ac]">⌘K</kbd>}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            {!collapsed && <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#aeb4bd]">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const act = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={collapsed ? it.label : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors",
                      act
                        ? "border border-[#e8eaed] bg-white font-semibold text-[#111827] shadow-xs"
                        : "border border-transparent font-medium text-[#4b5563] hover:bg-black/[0.03] hover:text-[#111827]",
                      collapsed && "justify-center border-transparent shadow-none",
                      collapsed && act && "border-transparent bg-indigo-50 text-indigo-600",
                    )}
                  >
                    {act && !collapsed && <span className="absolute -left-px bottom-2 top-2 w-[3px] rounded-full bg-indigo-600" />}
                    <Icon size={17} strokeWidth={act ? 2.1 : 1.8} className={cn(act && "text-indigo-600")} />
                    {!collapsed && it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-[#e8eaed] p-3">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-medium text-[#4b5563] transition-colors hover:bg-black/[0.03] hover:text-[#111827]",
            isActive("/settings") && "border border-[#e8eaed] bg-white font-semibold text-[#111827] shadow-xs",
            collapsed && "justify-center",
          )}
        >
          <Settings size={17} />{!collapsed && "Settings"}
        </Link>
        <SidebarProfile collapsed={collapsed} user={user} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen shrink-0 md:block">
        <div className="relative h-full">
          {rail}
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#e8eaed] bg-white text-[#9aa1ac] shadow-sm transition-colors hover:border-[#d6dae0] hover:text-[#111827]"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2.5 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 hover:bg-[#f1f3f5]"><Menu size={20} /></button>
        <span className="text-sm font-semibold text-[#111827]">{active?.name}</span>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <motion.div className="absolute left-0 top-0 h-full" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 400, damping: 36 }}>
              <div className="relative h-full">{rail}<button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 text-[#9aa1ac]"><X size={18} /></button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/app-shell/Sidebar.tsx
git commit -m "feat(shell): blueprint sidebar reskin (white-card active item, mono accents)"
```

---

### Task 7: WorkspaceSwitcher + SidebarProfile reskin

**Files:**
- Modify: `components/app-shell/WorkspaceSwitcher.tsx` (full replace)
- Modify: `components/app-shell/SidebarProfile.tsx` (full replace)

- [ ] **Step 1: Replace `WorkspaceSwitcher.tsx`**

Replace the entire contents with (logic unchanged; avatar → solid indigo square, add mono "Free plan", hairline tokens):

```tsx
"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type WS = { id: string; name: string; slug: string; role: string };

export function WorkspaceSwitcher({ collapsed, workspaces, activeId }: { collapsed: boolean; workspaces: WS[]; activeId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const initials = (active?.name || "W").trim().slice(0, 2).toUpperCase();

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await fetch("/api/workspaces/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
    setBusy(false); setOpen(false);
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
    const ws = await res.json().catch(() => ({}));
    if (res.ok && ws?.id) {
      await fetch("/api/workspaces/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ws.id }) });
      router.refresh();
      setBusy(false); setCreating(false); setName(""); setOpen(false);
    } else {
      setBusy(false); setErr(ws?.error || "Could not create workspace");
    }
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} title={collapsed ? active?.name : undefined} className={cn("flex w-full items-center gap-2.5 rounded-[10px] border border-[#e8eaed] px-2 py-1.5 hover:bg-[#f7f8fa]", collapsed && "justify-center border-transparent px-1.5 hover:bg-[#f1f3f5]")}>
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold tracking-[0.02em] text-white">{initials}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13.5px] font-semibold leading-tight text-[#111827]">{active?.name}</span>
            <span className="block font-mono text-[11px] text-[#9aa1ac]">Free plan</span>
          </span>
        )}
        {!collapsed && <ChevronsUpDown size={15} className="text-[#9aa1ac]" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aeb4bd]">Workspaces</p>
          {workspaces.map((w) => (
            <button key={w.id} onClick={() => switchTo(w.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#4b5563] hover:bg-[#f1f3f5]">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-[10px] font-bold text-white">{w.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-left">{w.name}</span>
              <span className="text-[10px] uppercase text-[#aeb4bd]">{w.role}</span>
              {w.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-[#f1f3f5]" />
          {creating ? (
            <div className="p-1.5">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Workspace name" className="w-full rounded-lg border border-[#d6dae0] px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={create} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : "Create"}</button>
                <button onClick={() => setCreating(false)} className="rounded-lg px-2 py-1.5 text-xs text-[#6b7280] hover:bg-[#f1f3f5]">Cancel</button>
              </div>
              {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"><Plus size={15} /> New workspace</button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `SidebarProfile.tsx`**

Replace the entire contents with (logic unchanged; avatar → ink circle, hairline tokens):

```tsx
"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCog, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarProfile({ collapsed, user }: { collapsed: boolean; user: { name: string; email: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  const initials = (user.name || user.email).trim().slice(0, 2).toUpperCase();

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function logout() {
    setOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login"); router.refresh();
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} title={collapsed ? (user.name || user.email) : undefined} className={cn("flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-black/[0.03]", collapsed && "justify-center")}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">{initials}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[#4b5563]">{user.name || user.email}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <div className="border-b border-[#f1f3f5] px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[#111827]">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-[#9aa1ac]">{user.email}</p>
          </div>
          <Link href="/account" className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f3f5]"><UserCog size={15} className="text-[#9aa1ac]" /> Account settings</Link>
          <button onClick={logout} disabled={out} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#4b5563] hover:bg-red-50 hover:text-red-600 disabled:opacity-60">{out ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} className="text-[#9aa1ac]" />} Sign out</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/app-shell/WorkspaceSwitcher.tsx components/app-shell/SidebarProfile.tsx
git commit -m "feat(shell): reskin workspace switcher + profile (solid indigo / ink avatars)"
```

---

### Task 8: Rebuild the Dashboard main area

**Files:**
- Modify: `components/dashboard/Dashboard.tsx`

This replaces the import block and the entire `Dashboard` function body. The helper components defined LOWER in the file (`AI_EXAMPLES`, `AiPageModal`, `EmptyState`, `TemplateModal`) are **kept unchanged**.

- [ ] **Step 1: Replace imports + remove dead helpers**

Replace the import block at the top of `components/dashboard/Dashboard.tsx` (lines 1-21, ending just before `type PageItem = {`) with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/blocks/templates";
import { filterPages, type DashboardFilter } from "@/lib/dashboard/filter";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { SubmissionsModal } from "./SubmissionsModal";
import { SegmentedFilter } from "./SegmentedFilter";
import { PageCard, type DashboardPage } from "./PageCard";
```

Then delete the now-unused `GRADIENTS` constant and the `timeAgo` function (both lived near the top of the file; `timeAgo` now lives in `PageCard.tsx`, and gradients are gone).

- [ ] **Step 2: Replace the `Dashboard` function**

Replace the `type PageItem = { ... }` declaration and the entire `export function Dashboard(...) { ... }` (everything up to — but NOT including — the line `const AI_EXAMPLES = [`) with:

```tsx
type PageItem = DashboardPage;

export function Dashboard({ pages }: { pages: PageItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [ready, setReady] = useState(false);
  const [inbox, setInbox] = useState<{ id: string; title: string } | null>(null);
  const [hasAi, setHasAi] = useState(false);
  const [aiModal, setAiModal] = useState(false);

  // Brief readiness gate so the loading skeleton is perceptible (incl. on refresh).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setHasAi(Array.isArray(d.providers) && d.providers.length > 0))
      .catch(() => {});
  }, []);

  // Open the new-page modal when ?new=1 is in the URL (e.g. from sidebar "New" button)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setModal(true);
      router.replace("/");
    }
  }, [searchParams, router]);

  async function generatePage(prompt: string): Promise<string | null> {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "page", prompt }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Generation failed");
    const blocks = d.blocks ?? [];
    const titled = blocks.find((b: any) => b?.props?.title)?.props?.title;
    const title = (titled || prompt).toString().slice(0, 60);
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content: blocks }),
    });
    const page = await res.json();
    return page.id ?? null;
  }

  const liveCount = pages.filter((p) => p.published).length;
  const counts = { all: pages.length, live: liveCount, drafts: pages.length - liveCount };
  const filtered = filterPages(pages, query, filter);

  async function create(template: Template) {
    setCreating(template.id);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: template.id === "blank" ? "Untitled Page" : `${template.name}`,
          content: template.build(),
        }),
      });
      const page = await res.json();
      router.push(`/editor/${page.id}`);
    } catch {
      setCreating(null);
    }
  }

  function createBlank() {
    const blank = TEMPLATES.find((t) => t.id === "blank");
    if (blank) create(blank);
  }

  async function remove(id: string) {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/pages/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className="w-full">
      <main className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2.5 flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.04em] text-[#aeb4bd]">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#4b5563]">Pages</span>
            </div>
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#111827]">Your pages</h1>
            <p className="mt-2.5 text-[13.5px] text-[#6b7280]">
              {pages.length} {pages.length === 1 ? "page" : "pages"} · {liveCount} live · create, edit and publish in one click
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {hasAi && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAiModal(true)}
                className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#e8eaed] bg-white px-4 text-[13.5px] font-medium text-[#111827] transition-colors hover:bg-zinc-50"
              >
                <Sparkles size={16} className="text-indigo-600" /> Generate with AI
              </motion.button>
            )}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setModal(true)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] bg-zinc-900 px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <Plus size={16} /> New page
            </motion.button>
          </div>
        </div>

        {pages.length === 0 ? (
          <div className="mt-8">
            <EmptyState onCreate={() => setModal(true)} />
          </div>
        ) : (
          <>
            {/* toolbar */}
            <div className="my-6 flex flex-wrap items-center justify-between gap-4">
              <SegmentedFilter value={filter} onChange={setFilter} counts={counts} />
              <div className="flex w-[280px] max-w-full items-center gap-2.5 rounded-[10px] border border-[#e8eaed] bg-white px-3.5 py-2.5">
                <Search size={16} className="text-[#aeb4bd]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="w-full bg-transparent text-[13.5px] text-[#111827] outline-none placeholder:text-[#aeb4bd]"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[15px] font-semibold text-[#111827]">No pages match “{query}”</p>
                <button
                  onClick={() => { setQuery(""); setFilter("all"); }}
                  className="mt-2 text-[13.5px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                {filtered.map((p, i) => (
                  <PageCard
                    key={p.id}
                    page={p}
                    index={i}
                    deleting={deleting === p.id}
                    onOpenSubmissions={() => setInbox({ id: p.id, title: p.title })}
                    onDelete={() => remove(p.id)}
                  />
                ))}
                {/* new blank page tile */}
                <button
                  onClick={createBlank}
                  disabled={!!creating}
                  className="group flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-[#d6dae0] text-[#9aa1ac] transition-all hover:border-indigo-600 hover:bg-indigo-50/40 hover:text-indigo-600 disabled:opacity-60"
                >
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-[11px] border-[1.5px] border-current">
                    <Plus size={20} />
                  </span>
                  <span className="text-[13.5px] font-semibold">New blank page</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {modal && (
          <TemplateModal creating={creating} onClose={() => !creating && setModal(false)} onPick={create} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiModal && (
          <AiPageModal onClose={() => setAiModal(false)} onGenerate={generatePage} onDone={(id) => router.push(`/editor/${id}`)} />
        )}
      </AnimatePresence>

      <SubmissionsModal page={inbox} onClose={() => setInbox(null)} />
    </div>
  );
}
```

- [ ] **Step 3: Verify the kept helpers still resolve**

The `AiPageModal`, `EmptyState`, and `TemplateModal` components below use only `motion`, `AnimatePresence`, `Sparkles`, `Loader2`, `X`, and `Plus` — all still imported in Step 1. Do not modify them.

Run: `npx tsc --noEmit`
Expected: PASS. (If tsc reports an unused import, remove only the genuinely unused one; all listed imports should be used by either the new `Dashboard` body or the kept modals.)

- [ ] **Step 4: Full test run**

Run: `npm test`
Expected: all green (node + dom projects), including `dashboard-filter`, `page-thumbnail`, `page-card`.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): blueprint header, segmented filter, card grid + new-page tile"
```

---

### Task 9: Manual visual verification

> No code. Confirm the redesign against the reference with `next dev` running.

- [ ] **Step 1:** Ensure the dev server is running (`npm run dev`) and open `http://localhost:3000/`.
- [ ] **Step 2:** Verify the shell: paper background, white sidebar with hairline border, solid-indigo "AC" workspace avatar + mono "Free plan", inset search pill with `⌘K`, letter-spaced BUILD/BRAND/GROW labels, and the active "Pages" item rendered as a white card with an indigo left-bar + indigo icon. Collapse via the edge toggle → 68px rail with the active item in indigo-50.
- [ ] **Step 3:** Verify the header: mono `WORKSPACE / Pages` breadcrumb, large "Your pages", `N pages · M live · …` subtitle, "Generate with AI" (white, indigo sparkle, only if AI configured) + "New page" (ink) buttons.
- [ ] **Step 4:** Verify the toolbar: segmented All/Live/Drafts with live counts that re-filter the grid; search box filters by title/slug; "Drafts" shows only unpublished.
- [ ] **Step 5:** Verify cards: 16:10 real-screenshot thumbnail, Live/Draft status pill with dot, hover → "Open editor" overlay + revealed action icons (Submissions w/ badge, View live for published, Edit, Delete). The "New blank page" dashed tile creates a blank page and opens the editor.
- [ ] **Step 6:** Verify a no-match search shows the centered "No pages match" + Clear filters.

---

## Self-Review

**Spec coverage:**
- Mono font + paper bg → Task 1. ✅
- `filterPages` → Task 2; `SegmentedFilter` → Task 3. ✅
- Real-screenshot 16:10 thumbnail + neutral fallback → Task 4 (PageThumbnail) + Task 5 (PageCard frame). ✅
- Card: status pill, hover overlay, hover-reveal actions, mono meta → Task 5. ✅
- Header (breadcrumb, h1, subtitle, AI/New buttons), toolbar (segmented + search), grid, "New blank page" tile, no-match state → Task 8. ✅
- Sidebar reskin (active white-card + indigo bar, mono labels, collapsed rail) → Task 6. ✅
- Workspace switcher (solid indigo + "Free plan") + profile (ink avatar) → Task 7. ✅
- Keep Geist, indigo accent, edge collapse toggle, existing modals/routing/screenshot pipeline → preserved across Tasks 6-8. ✅
- Tests: filterPages unit, PageThumbnail dom (updated), PageCard dom → Tasks 2, 4, 5. ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `DashboardFilter` defined in Task 2, consumed by `SegmentedFilter` (Task 3) and `Dashboard` (Task 8). `DashboardPage` defined in `PageCard` (Task 5), reused as `Dashboard`'s `PageItem` (Task 8) and the DTO already supplies those exact fields (`id, title, slug, published, updatedAt, submissions, thumbnailUrl, thumbnailVersion, thumbnailStale`). `PageThumbnail` props drop `gradient` in Task 4; its only callers (the Task 4 Dashboard patch, then `PageCard`) pass the new shape. `filterPages(pages, query, filter)` signature consistent across Tasks 2 and 8. `PageCard` props (`page, index, deleting, onOpenSubmissions, onDelete`) match the call site in Task 8. ✅
