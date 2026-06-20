# Design: Pagecraft marketing site — "make it feel alive" enhancement

**Date:** 2026-06-20
**Status:** Approved (design) — pending implementation plan
**Scope:** Enhance the existing standalone Pagecraft marketing site at **`~/Desktop/projects/pagecraft-site`** with cinematic scroll interactions, WebGL, richer motion, and new product-focused content sections. Planning artifacts live in the dnd-pagebuilder repo's `docs/superpowers/`; all code changes happen in the external `pagecraft-site` repo.

## Goal

Take the existing, already-shipped landing page from "clean but generic" to a distinctive, alive, award-tier feel: scroll-driven storytelling, parallax depth, a WebGL hero, a pinned product showcase, and several new product-related sections — without sacrificing load performance or accessibility.

## Research basis (web search, 2026)

- **Library choice:** GSAP's ScrollTrigger is the standard for scroll choreography (pinning, scrub, parallax) and **GSAP is now fully free** incl. plugins. Pairing with **Lenis** smooth-scroll is the de-facto award-site stack. Three.js/WebGL adds the most "wow" at the cost of bundle weight and perf care.
- **Non-generic design:** outcome-driven storytelling over feature lists; a "why this is different / how it works" mechanism section; authentic product visuals; specific proof over generic badges; sticky shrinking nav; *meaningful* micro-motion, not noise.

## Decisions (locked during brainstorming)

1. **Motion stack:** **Max wow** — add `gsap` + `ScrollTrigger` + `lenis` + Three.js (`three` + `@react-three/fiber` + `@react-three/drei`) **on top of** the existing framer-motion. framer-motion keeps component entrance/hover; GSAP owns scroll choreography; Lenis provides smooth scroll; Three.js provides the WebGL hero + depth.
2. **WebGL:** a hero backdrop of softly-drifting 3D "blocks" (on-brand: the product is blocks) over a subtle shader gradient, plus a pointer-driven 3D tilt on the product mock.
3. **New sections:** pinned product showcase (centerpiece), bento feature grid, template gallery (parallax rows), use-cases/personas, comparison check-grid, FAQ accordion.
4. **Performance/accessibility is non-negotiable** and gated (see below).
5. **No unit tests** for the landing page (per the user's standing call for this project). Gate is `tsc --noEmit` (0 errors) + `next build`.
6. **Phased build** — motion foundation → WebGL hero → pinned showcase → parallax pass → new content sections — each phase building green.

## Non-goals (YAGNI)

- No backend/CMS/auth (unchanged from the base site). CTAs keep linking to `app.pagecraft.dev/*` placeholders.
- No multi-page expansion (still a single `/`).
- No tests for sections.
- No real template/screenshot assets required — template gallery uses stylized CSS/placeholder thumbnails (consistent with the bespoke editor mock).

## Architecture (in `~/Desktop/projects/pagecraft-site`, `src/`-based, `@/` → `./src`)

### Motion foundation
- `src/components/motion/SmoothScroll.tsx` — a `"use client"` provider that initializes **Lenis** and drives **GSAP's ticker**, registers `ScrollTrigger`, and calls `ScrollTrigger.update` on Lenis scroll. **Disabled entirely under `prefers-reduced-motion`** (renders children with native scroll). Wraps the page in `src/app/layout.tsx` (or a client wrapper inside it).
- `src/lib/motion/useGsap.ts` (or `src/components/motion/`) — small helpers: a `useParallax(ref, opts)` hook (ScrollTrigger scrub on transform/`y`), and a `useReveal`/scrub helper. All helpers no-op under reduced motion and clean up their ScrollTriggers on unmount.
- `src/lib/motion/env.ts` — a `useMotionEnv()` hook returning `{ reducedMotion, isMobile, allowWebgl }` from `matchMedia('(prefers-reduced-motion: reduce)')`, `matchMedia('(pointer: coarse)')` / viewport width, and a `navigator.hardwareConcurrency` heuristic. Single source of truth for gating.

### WebGL isolation (Three.js / R3F)
- Every Three.js scene is a `"use client"` component **dynamically imported with `next/dynamic({ ssr: false })`** and mounted only after first paint and only when `allowWebgl` is true. Never in the SSR/static path → `next build` stays green and LCP is unaffected.
- `src/components/webgl/HeroScene.tsx` — an `@react-three/fiber` `<Canvas>` with: a set of instanced/low-poly rounded "block" meshes drifting and parallaxing with scroll + pointer; a soft shader-gradient background plane (custom GLSL or `@react-three/drei` helpers). DPR capped (e.g. `dpr={[1, 1.5]}`), `frameloop` paused when offscreen/tab-hidden.
- `src/components/webgl/HeroSceneFallback.tsx` — a static CSS gradient/blurred-orbs backdrop used when `allowWebgl` is false (mobile/low-power/reduced-motion) or before the scene loads.

### Scroll choreography
- **Parallax pass** on existing sections (hero background layers, stats band, testimonials) via `useParallax`.
- **Pinned product showcase** (`src/components/sections/ProductShowcase.tsx`): a ScrollTrigger `pin` holds the editor mock centered while a scrubbed timeline swaps 3–4 differentiator captions/highlights as the user scrolls through the section's scroll length. Reduced-motion → a plain stacked (non-pinned) list of the same content.
- **Magnetic CTAs**: primary buttons get a subtle pointer-follow magnetic effect (framer-motion or a small pointer handler), disabled on touch/reduced-motion.

### New / reworked sections (`src/components/sections/`)
| Section | What it is |
|---|---|
| `ProductShowcase` (new, centerpiece) | Pinned, scroll-scrubbed walkthrough of how Pagecraft is different (visual builder vs code → per-breakpoint → CMS binding → one-click publish), pinning the editor mock. |
| `Features` (rework → bento) | Asymmetric **bento grid** of varied tile sizes; one tile holds a mini live demo (small animated block/cursor). Replaces the uniform 3-col grid. |
| `TemplateGallery` (new) | Two horizontal rows of stylized template thumbnails scrolling in opposite directions on scroll (parallax marquee). |
| `UseCases` (new) | Persona/outcome cards or tabs: Landing pages · Portfolios · SaaS sites · Blogs. |
| `Comparison` (new) | A clean check-grid: Pagecraft vs hand-coding vs other builders — decision-grade differentiation. |
| `FAQ` (new) | Accordion built on the UU/react-aria Disclosure pattern. |
| Hero (enhance) | WebGL backdrop (`HeroScene`) + 3D-tilt product card + parallax. |
| Stats, Testimonials (enhance) | Parallax + scrub-reveal. LogoCloud, Pricing, FinalCTA, Footer kept (light parallax where tasteful). |

Content for all new sections lives in `src/lib/content.ts` (extend it with `USE_CASES`, `COMPARISON`, `FAQ`, `TEMPLATES`, and the showcase steps), keeping copy out of JSX.

### Page composition
`src/app/page.tsx` recomposed to the new order, e.g.: Nav · Hero(WebGL) · LogoCloud · ProductShowcase(pinned) · Features(bento) · TemplateGallery · UseCases · Stats · Testimonials · Comparison · Pricing · FAQ · FinalCTA · Footer.

## Performance / accessibility strategy (gated, non-negotiable)

- `prefers-reduced-motion: reduce` → **no Lenis, no ScrollTrigger scrub/pin, no WebGL**; sections fall back to static layout + simple opacity fades. The existing global reduced-motion CSS guard stays.
- **Mobile / low-power** (coarse pointer or small viewport or low `hardwareConcurrency`) → **skip WebGL** (static fallback), keep parallax minimal/cheap.
- WebGL: cap DPR, pause `frameloop` when tab hidden or canvas offscreen (IntersectionObserver), dispose on unmount.
- Hero headline + CTAs remain server-rendered (fast LCP, SEO intact). WebGL + Lenis mount post-paint.
- Keyboard/focus: pinned section must not trap focus or break tab order; anchor links still jump correctly with Lenis (use Lenis `scrollTo` for in-page anchors).

## Phasing (each phase builds green: `tsc` 0 + `next build`)

1. **Motion foundation** — deps, `useMotionEnv`, `SmoothScroll` (Lenis+GSAP), parallax helpers, reduced-motion bypass. Apply light parallax to one existing section to prove the pipeline.
2. **WebGL hero** — `HeroScene` + fallback, dynamic `ssr:false`, gating, 3D-tilt product card.
3. **Pinned ProductShowcase** — the centerpiece scroll-scrub + pin, with reduced-motion fallback.
4. **Parallax/scrub pass** — enhance Stats, Testimonials, hero layers; magnetic CTAs.
5. **New content sections** — Features→bento, TemplateGallery, UseCases, Comparison, FAQ; extend `content.ts`; recompose `page.tsx`.

## Testing & gate

- **No unit tests** (project standing decision). Gate after every phase: `npx tsc --noEmit` (0 errors) + `npm run build` (must stay green; WebGL via `ssr:false` must not break the static build). Visual/perf verification (incl. a Lighthouse pass and a reduced-motion check) is a manual pass by the user.

## Risks / open items (resolved at plan time)

- **React 19 / Next 16 compatibility:** `@react-three/fiber` v9 + `@react-three/drei` target React 19 — the plan's first task pins compatible versions and confirms `next build` succeeds with `ssr:false` dynamic import. If R3F v9 misbehaves under Turbopack, fall back to a CSS/canvas-2D shader gradient for the hero (still "alive", no Three.js) — but attempt WebGL first.
- **Bundle weight:** Three.js is heavy; mitigated by `ssr:false` + lazy mount + mobile/low-power skip. Keep R3F scene minimal (instanced meshes, no heavy textures).
- **GSAP + Lenis + Next App Router:** all client-only; `SmoothScroll` is `"use client"`; ScrollTrigger registered once. Anchor navigation routed through Lenis.
- **Scope:** large; the phasing keeps each step shippable and green. Sections can be trimmed if the user wants to cut scope mid-build.
