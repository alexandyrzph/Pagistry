# Design: Pagistry marketing website (standalone)

**Date:** 2026-06-20
**Status:** Approved (design) — pending implementation plan
**Scope:** A new, standalone marketing website for **Pagistry** (the drag-and-drop site builder this repo implements). Built in a **separate folder outside this repo**. The planning artifacts (this spec + the plan) live in this repo's `docs/superpowers/`; the site itself is created at the external path during execution.

## Goal

A single, highly-interactive, unique-looking marketing landing page for Pagistry that uses the real Untitled UI React library, with a bespoke animated mock of the Pagistry editor as the hero centerpiece.

## Decisions (locked during brainstorming)

1. **Location:** standalone project at `~/Desktop/projects/pagistry-site` (sibling to `dnd-pagebuilder`). Created fresh during execution.
2. **Stack:** Next.js (App Router) + React 19 + TypeScript + Tailwind v4.
3. **UI library:** the real **Untitled UI React** open-source components (copied into the repo via their CLI — you own the code; built on react-aria-components + Tailwind v4) for primitives + theme tokens. **framer-motion** for interactions.
4. **Scope:** a **single long landing page** (`/`). Multi-page (separate Pricing/Features/About) is explicitly phase 2.
5. **Interactivity flavor:** Untitled UI's clean, light aesthetic + a handful of **signature interactions** (not bold/experimental, not bare-minimum): animated editor mock, scroll-reveals, count-up stats, pricing toggle, hover-tilt cards.
6. **Hero visual:** a **bespoke animated HTML/CSS recreation of the Pagistry editor** (sidebar + canvas + blocks, a cursor dragging a block in). No external screenshot asset required.

## Non-goals (YAGNI)

- No backend, CMS, database, or real authentication. "Log in" / "Sign up" link out to the main Pagistry app or a placeholder URL.
- No multi-page site (single `/` only).
- No blog, i18n, A/B testing, cookie banner, or analytics integration (a no-op analytics stub is acceptable but not required).
- Not pixel-bound to a real product screenshot — the editor mock is a stylized recreation, not a screenshot.

## Architecture

### Project setup

- Scaffolded with `create-next-app` (App Router, TypeScript, Tailwind v4, ESLint) at `~/Desktop/projects/pagistry-site`.
- Untitled UI React components added via their CLI into `components/ui/` (you own the copied source). UU theme tokens wired into the Tailwind v4 `@theme` layer / `globals.css`.
- `framer-motion` for animation; the project's icon set (Untitled UI icons or `lucide-react`) for iconography.
- Display + body fonts via `next/font` (a strong display face for headlines — e.g. a geometric sans — plus a clean body face).

### File structure (one responsibility per file)

- `app/layout.tsx` — root layout, fonts, global metadata (title/description/OG), analytics stub slot.
- `app/page.tsx` — composes the section components in order; nothing else.
- `app/globals.css` — Tailwind v4 import + UU `@theme` tokens + the hero grid background utility + reduced-motion guard.
- `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.*` (static or generated OG image), favicon.
- `components/sections/` — `Nav.tsx`, `Hero.tsx`, `LogoCloud.tsx`, `Features.tsx`, `HowItWorks.tsx`, `Stats.tsx`, `Testimonials.tsx`, `Pricing.tsx`, `FinalCTA.tsx`, `Footer.tsx`. Each is a focused, self-contained section.
- `components/product-mock/EditorMock.tsx` — the animated Pagistry-editor centerpiece (the signature unit).
- `components/motion/` — `Reveal.tsx` (scroll-reveal wrapper), `CountUp.tsx` (in-view number count-up), `Tilt.tsx` (pointer hover-tilt wrapper). Isolated so motion logic is reusable and independently testable.
- `components/ui/` — the copied Untitled UI primitives.
- `lib/content.ts` — ALL copy + data (nav links, features, how-it-works steps, stats, testimonials, pricing tiers, logo list, footer links) as typed constants, so text edits never touch JSX.

### The page (top → bottom)

1. **Nav** (sticky) — Pagistry wordmark/logo, anchor links (`#features`, `#how`, `#pricing`), `Log in` (UU secondary) + `Sign up` (UU primary). Gains a subtle background blur + shadow + border once scrolled past the hero top.
2. **Hero** — centered: an eyebrow **Badge pill** ("New · v2 — see what's new →"), a large bold headline, a muted subtitle, two CTAs (`▷ Demo` secondary + `Start building` primary). Faint **grid background** behind it (like the reference). The `EditorMock` sits directly below, slightly overlapping the hero's bottom edge, framed in browser-ish chrome with a soft shadow.
3. **LogoCloud** — "Trusted by teams at" + a row of greyscale placeholder brand logos with a slow, subtle marquee.
4. **Features** — section heading + a 3-column grid of `Tilt` cards (icon, title, blurb): drag-and-drop blocks, responsive per-breakpoint controls, built-in CMS, one-click publish, AI section generation, shared design system. (Content from `lib/content.ts`.)
5. **HowItWorks** (`#how`) — 3 numbered steps revealed on scroll (alternating text/visual layout): _Drag in blocks → Tune styles per device → Publish in one click_.
6. **Stats** — a band of 3–4 `CountUp` figures that animate when scrolled into view (e.g. pages built, block types, uptime).
7. **Testimonials** — a small grid of quote cards (quote, avatar, name/role). Placeholder content.
8. **Pricing** (`#pricing`) — a `month/year` toggle that animates the prices + shows a "save 20%" badge on yearly; 3 UU pricing cards (Free / Pro / Team) with feature lists and a CTA each; the Pro card is visually emphasized.
9. **FinalCTA** — a bold dark or gradient band: short headline + `Sign up` primary CTA.
10. **Footer** — brand blurb, link columns (Product / Resources / Company), social icons, copyright.

### Signature interactions

- **EditorMock animation:** a looping sequence — a floating cursor element moves to a block chip in the sidebar, "grabs" it, drags it onto the canvas, the chip fades and a real-looking block appears/settles into the canvas; the whole frame has a gentle idle float. Implemented with framer-motion (transform/opacity only, GPU-friendly), on a fixed timeline that loops. Pauses/simplifies under reduced-motion.
- **Reveal:** sections fade/slide in via `whileInView` (once, ~0.2 amount).
- **CountUp:** numbers animate from 0 to target when their band enters the viewport.
- **Pricing toggle:** animated price swap + savings badge.
- **Tilt:** feature cards tilt slightly toward the pointer on hover (small rotateX/rotateY), spring back on leave.
- **Nav scroll-state:** transparent over hero → solid/blur after scroll.
- **Reduced motion:** every animation respects `prefers-reduced-motion` (the `motion/` helpers check it; the EditorMock renders a static settled state).

## EditorMock (the signature unit) — detail

A pure presentational component, no dependency on the real app. Structure:

- Outer **browser chrome** (rounded frame, top bar with 3 dots + a faux URL "pagistry.com/editor"), soft shadow, ~16:10.
- Inside: a **left sidebar** (a short list of draggable "block" chips — Hero, Text, Image, Button, Columns), a slim **top bar** (device toggle, publish button), and a **canvas** showing 2–3 already-placed stylized blocks (a hero band, a text line, a button).
- A **floating cursor** + a **ghost chip** animated to perform the drag-in loop; on "drop," a new block element animates into the canvas.
- All content is faux/stylized (not the actual Pagistry components) but visually evokes the real builder.

## Content, SEO

- `lib/content.ts` holds all marketing copy (drafted for Pagistry — a drag-and-drop site builder) + placeholder logos/testimonials. The user edits copy there without touching components.
- Next Metadata API: title, description, Open Graph + Twitter card, an OG image (static asset or `opengraph-image` route), favicon/icon, `sitemap.ts`, `robots.ts`.

## Testing & gate

Marketing sites are visual, so testing is light and targets logic-bearing units, not pixels:

- **vitest + @testing-library/react** smoke/behavior tests:
  - `Nav` renders the brand + the anchor links + Log in/Sign up.
  - `Hero` renders the headline text + both CTAs.
  - `Pricing` toggle flips the displayed price between monthly and yearly.
  - `CountUp` reaches its target value.
  - `EditorMock` mounts without crashing.
  - `lib/content.ts` shape (e.g. 3 pricing tiers) sanity.
- **Gate:** `npx tsc --noEmit` + `npm run build` (a real Next production build — valid here because it's a _separate_ repo with no live dev server to clobber). Lighthouse / visual polish is a manual pass.

## Risks / open items (resolved at plan time)

- **Untitled UI React free surface is a subset** (PRO gates the richest templates/sections). The primitives needed (Button, Badge, Input, etc.) are in the free core; the marketing _sections_ are hand-built. The plan's first task verifies the exact free component set actually available from the CLI and adjusts which primitives we consume vs. build.
- **External project creation:** execution runs `create-next-app` + dependency installs at `~/Desktop/projects/pagistry-site` — a real, outward action performed at build time (outside this repo).
- **Motion performance:** keep all animation to transform/opacity, lazy-trigger on in-view, and gate on reduced-motion to keep the page smooth.
- **"Sign up"/"Log in" targets:** link to a placeholder/the main app URL; no auth is built.
