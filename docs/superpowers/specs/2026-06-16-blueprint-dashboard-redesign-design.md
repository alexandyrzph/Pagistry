# Blueprint dashboard redesign

**Date:** 2026-06-16
**Status:** Approved — ready for implementation plan
**Reference:** `/Users/alexander/Downloads/PageCraftStudio.jsx` (the user's visual target)

## Goal

Reskin the app shell and rebuild the index page (`/` → `app/(app)/page.tsx` →
`components/dashboard/Dashboard.tsx`) to match the reference's "blueprint" editorial
aesthetic: off-white paper, ink-black type, a single indigo accent, monospace metadata,
16:10 cards with status pills and hover-reveal actions, a segmented All/Live/Drafts
filter, and a "New blank page" tile.

The reference fakes its card thumbnails with scaled bars; we instead keep the **real
page screenshots** shipped previously (`PageThumbnail`), reframed into the 16:10 card.

## Decisions (from brainstorming)

- **Scope:** full shell. The sidebar (shared chrome on every app page) is reskinned, so
  the new look applies app-wide. The index page's main area is rebuilt.
- **Thumbnails:** real screenshots reframed to 16:10, with a clean neutral blank-paper
  fallback (+ shimmer while generating). No gradient+letter, no faux scaled-bar previews.
- **Font:** keep Geist (Inter-like). Wire `--font-mono` → Geist Mono for monospace accents.
- **Accent:** indigo-600 `#4f46e5` (already the app accent; equals the reference's accent).
- **Collapse toggle (deliberate deviation):** keep the existing sidebar edge-circle toggle
  (works on every page) rather than the reference's in-header collapse button.

## Design language

Mapped onto the existing Tailwind v4 / Geist setup. Reference hexes used as arbitrary
Tailwind values where they differ from the default scale:

| Token | Value | Usage |
|-------|-------|-------|
| paper | `#f7f8fa` | app background |
| surface | `#ffffff` | cards, sidebar |
| hairline | `#e8eaed` | borders/dividers |
| inset | `#f1f3f5` | search pill, segmented track |
| ink | `#111827` | primary text, "New page" button |
| secondary | `#4b5563` / `#6b7280` | nav text, subtitles |
| muted | `#9aa1ac` / `#aeb4bd` | slugs, section labels, icons-idle |
| accent | indigo-600 `#4f46e5` | active state, AI sparkle, badges |
| live | `#047857` text + `#10b981` dot | published status |

`globals.css`: add `--font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;`
to `@theme inline` so `font-mono` resolves to Geist Mono.

## Component changes

### Shell (app-wide)

**`app/(app)/layout.tsx`** — change the wrapper background from `bg-zinc-50` to the paper
tone `bg-[#f7f8fa]`. Structure (sidebar + `<main>`) unchanged.

**`components/app-shell/Sidebar.tsx`** — reskin only (no structural/logic change):
- Hairline borders `border-[#e8eaed]`, white surface.
- Search row → inset pill `bg-[#f1f3f5]`, muted "Search" + `⌘K` kbd (existing handler).
- Section labels → `text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#aeb4bd]`.
- **Active nav item** changes from `bg-indigo-600 text-white` to a white card: `bg-white
  border border-[#e8eaed] shadow-xs text-[#111827] font-semibold`, an absolute 3px indigo
  left-bar (`bg-indigo-600 rounded`), and an indigo icon. Idle = `text-[#4b5563]`, hover =
  faint wash. Settings link follows the same active treatment.
- Collapsed (68px) rail: icon-only; active = `bg-indigo-50 text-indigo-600`.
- Keep the edge-circle collapse toggle and the `setSidebarCookie` mechanism; restyle only.

**`components/app-shell/WorkspaceSwitcher.tsx`** — avatar → solid indigo rounded square
with white "AC"-style initials (derive from workspace name); show workspace name + mono
"Free plan" label + `ChevronsUpDown`. Dropdown behavior unchanged.

**`components/app-shell/SidebarProfile.tsx`** — ink circle avatar with initial, name +
muted email; menu behavior unchanged.

### Index main area

**`components/dashboard/Dashboard.tsx`** (orchestrator — keeps all state, data, modals,
`hasAi` gate, `?new=1` handling, `generatePage`, `create`, `remove`, skeleton gate):
- Container: `mx-auto max-w-[1320px] px-6 py-10 lg:px-12`.
- **Header** (flex, items-end, justify-between, wrap):
  - mono breadcrumb `WORKSPACE / Pages`; `h1` "Your pages" (`text-[32px] font-bold
    tracking-tight`); subtitle `${count} pages · ${liveCount} live · create, edit and
    publish in one click`.
  - Right: "Generate with AI" (white, border, indigo `Sparkles`, gated by `hasAi`, opens
    `aiModal`) + "New page" (`bg-zinc-900 text-white`, opens template modal).
- **Toolbar** (flex, justify-between, wrap):
  - Left: `<SegmentedFilter>` All/Live/Drafts with counts.
  - Right: search `<input>` (white, hairline border, `Search` icon) bound to `query`.
- **Grid:** `grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]`,
  rendering `<PageCard>` per filtered page, then a dashed **"New blank page"** tile that
  creates a blank page (calls the existing blank-template create path).
- **States:** keep `EmptyState` (no pages at all); restyle the no-search-match block to the
  reference's centered text. Keep the `ready`/`DashboardSkeleton` gate.
- **Filtering:** replace the inline query filter with `filterPages(pages, query, filter)`.

**`lib/dashboard/filter.ts`** (new, pure):
```
type Filter = "all" | "live" | "drafts";
filterPages(pages, query, filter): PageItem[]
// query: case-insensitive match on title or slug
// filter: all | live(published) | drafts(!published)
```

**`components/dashboard/SegmentedFilter.tsx`** (new, presentational): three options
(`all`/`live`/`drafts`) with counts; active = white pill `shadow-xs` on `bg-[#f1f3f5]`
track; `value` + `onChange` props.

**`components/dashboard/PageCard.tsx`** (new — extracted from the inline card map):
- Props: the `PageItem` plus the action callbacks (`onOpenSubmissions`, `onDelete`,
  `deleting`) — mirrors the data Dashboard already has.
- White card, `border-[#e8eaed]`, `rounded-[14px]`, overflow-hidden, hover lift
  (`-translate-y-0.5`) + `shadow-lg` + border darken.
- Thumbnail wrapper `aspect-[16/10] border-b border-[#eef0f2]` containing `<PageThumbnail>`.
  Top-left status pill (mono uppercase): live → emerald dot+text, draft → muted dot+text.
  Hover overlay: `bg-zinc-900/[0.04]` + centered "Open editor" pill (`bg-zinc-900 text-white`),
  `pointer-events-none`. The card's thumbnail+title link to `/editor/${id}`.
- Meta row: title (truncate, `text-[14.5px] font-semibold`) + mono `slug · updated`.
  Hover-reveal action group (opacity/translate transition): Submissions (`Inbox` + count
  badge when `submissions>0`, opens modal), View live (`ExternalLink` → `/p/${slug}` when
  `published`), Edit (→ `/editor/${id}`), Delete (danger, calls `onDelete`).

**`components/dashboard/PageThumbnail.tsx`** (adjust): render to **fill its parent** (the
card's `aspect-[16/10]` wrapper) instead of a fixed `h-32`. Image: `h-full w-full
object-cover object-top`. Status pill + hover overlay move OUT to `PageCard` (PageThumbnail
renders only image / fallback / shimmer). Fallback (no `initialUrl`, not loading) = neutral
blank-paper placeholder (paper bg + faint centered page glyph). Keep the lazy-regen effect,
the shared `limiter`, cache-busting, and failure-safety unchanged.

## Data flow

No new server data needed. `Dashboard` already receives the DTO (`id, title, slug,
published, updatedAt, submissions, thumbnailUrl, thumbnailVersion, thumbnailStale`).
`liveCount = pages.filter(p => p.published).length`. Filter state is client-local.

## Error handling

Unchanged. Thumbnail failures stay isolated (last image / neutral fallback). No new
network calls beyond the existing thumbnail regen.

## Testing (gate = `tsc` + `vitest`, no `next build`)

- **Unit:** `filterPages` — search-by-title, search-by-slug, all/live/drafts, combined.
- **Dom:** update `tests/page-thumbnail.dom.test.tsx` for the neutral fallback (no more
  gradient letter "A"); assert image renders with cache-bust when `initialUrl` present and
  fresh. Add `tests/page-card.dom.test.tsx` — Live page shows "Live" pill + the view-live
  action; Draft shows "Draft" pill and no view-live action.
- **Visual:** manual check against the reference at `http://localhost:3000/`.

## Out of scope (YAGNI)

Modal redesigns (TemplateModal/AiPageModal/SubmissionsModal keep current look), command
palette, mobile drawer redesign (keeps working), faux scaled-bar previews, and any change
to the screenshot pipeline.
