# Pagecraft Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **VISUAL CRAFT NOTE:** This is a marketing site — the presentational sections (Hero, Features, HowItWorks, Testimonials, FinalCTA, Footer, LogoCloud) are where design quality lives. For those tasks, the implementing subagent SHOULD invoke the **frontend-design** skill to elevate the visual polish beyond the compiling skeletons given here. This plan fixes the *contracts, structure, content wiring, and tests*; it deliberately does not freeze pixel-final JSX for every section. Logic-bearing units (motion helpers, EditorMock animation, Pricing toggle, Nav scroll, CountUp) ARE fully specified and TDD'd.

**Goal:** A standalone, highly-interactive, Untitled-UI-based marketing landing page for Pagecraft, with a bespoke animated mock of the Pagecraft editor as the hero centerpiece.

**Architecture:** A fresh Next.js (App Router) + Tailwind v4 project scaffolded by the Untitled UI React CLI at `~/Desktop/projects/pagecraft-site`. One route `/` composed of focused section components. All copy/data lives in `lib/content.ts`. Animation lives in three reusable `components/motion/` helpers (built on framer-motion) plus the `EditorMock`. Every animation respects `prefers-reduced-motion`.

**Tech Stack:** Next.js App Router, React 19.2, TypeScript, Tailwind v4.2, Untitled UI React (react-aria-components base), `@untitledui/icons`, framer-motion, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-20-pagecraft-marketing-site-design.md` (in the dnd-pagebuilder repo).

**IMPORTANT — this builds in a SEPARATE repo.** All `npm`/`git` commands run inside `~/Desktop/projects/pagecraft-site`, NOT the dnd-pagebuilder repo. The Untitled UI scaffold runs its own `git init`; commits below are commits *in the new project*.

**Gate (after each task):** `npx tsc --noEmit` and `npm test` (vitest). The full build gate `npm run build` runs in Task 11. (No live-dev-server clobbering concern — this is a separate repo.)

**Conventions:** Use the scaffold's `@/` path alias and its `cx` util (`@/utils/cx`) for classNames — NOT `cn`/`clsx`. If the scaffold places code under `src/`, prepend `src/` to the component paths below. Confirm the alias from the generated `tsconfig.json` in Task 1.

---

## File Structure (in `~/Desktop/projects/pagecraft-site`)

**Created by the UU scaffold (Task 1):** `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `styles/theme.css`, `utils/cx.ts`, `tsconfig.json`, `package.json`, etc.

**Created by this plan:**
- `lib/content.ts` — all copy + data (typed).
- `components/motion/Reveal.tsx`, `CountUp.tsx`, `Tilt.tsx` — reusable animation helpers.
- `components/product-mock/EditorMock.tsx` — animated Pagecraft-editor centerpiece.
- `components/sections/Nav.tsx`, `Hero.tsx`, `LogoCloud.tsx`, `Features.tsx`, `HowItWorks.tsx`, `Stats.tsx`, `Testimonials.tsx`, `Pricing.tsx`, `FinalCTA.tsx`, `Footer.tsx`.
- `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`.
- `vitest.config.ts`, `vitest.setup.ts`, and colocated tests under `components/**/__tests__/` + `lib/__tests__/`.

---

## Task 1: Scaffold the project, deps, and test harness

**Files:** the whole scaffold + `vitest.config.ts`, `vitest.setup.ts`, `components/__tests__/smoke.test.tsx`.

- [ ] **Step 1: Scaffold with the Untitled UI CLI**

Run from the projects directory so the new folder lands as a sibling:

```bash
cd ~/Desktop/projects
npx untitledui@latest init pagecraft-site --nextjs -y -c indigo
```

Expected: creates `~/Desktop/projects/pagecraft-site/` with a Next.js App Router project, Tailwind v4.2, react-aria-components, `@untitledui/icons`, `utils/cx.ts`, `styles/theme.css`, and runs `git init`. If `-c indigo` is rejected, run `npx untitledui@latest init --colors-list` to list valid color names and pick the closest to Pagecraft's indigo (#4f46e5) — e.g. `violet` or `brand`. If the CLI still prompts interactively, answer: project name `pagecraft-site`, framework Next.js, the chosen brand color.

- [ ] **Step 2: Confirm the scaffold + path alias**

```bash
cd ~/Desktop/projects/pagecraft-site
cat tsconfig.json | grep -A3 '"paths"'
ls app utils styles
```

Expected: a `@/*` path alias (note whether it maps to repo root or `src/`). Confirm `app/page.tsx`, `app/globals.css`, `utils/cx.ts` exist. If code lives under `src/`, treat every `@/components/...`/`@/lib/...` path in later tasks as `src/...` on disk (the `@/` import stays the same).

- [ ] **Step 3: Add free Untitled UI base components + framer-motion + test deps**

```bash
npx untitledui@latest add button badge input -y
npm install framer-motion
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

Expected: `components/base/buttons/...`, `.../badges/...`, `.../inputs/...` (or similar) appear — note the exact import paths the CLI prints; later tasks import the Button/Badge from wherever the CLI placed them (confirm with `npx untitledui@latest add` output or by reading the created files). If `add button` demands `login` (PRO), report it — buttons are base/free, so this should not happen.

- [ ] **Step 4: Add the `test` script to `package.json`**

In `package.json` `"scripts"`, add: `"test": "vitest run"`. (Keep the scaffold's existing `dev`/`build`/`start`/`lint`.)

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

(If Step 2 showed the alias maps to `src/`, change the alias target to `./src/`.)

- [ ] **Step 6: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom lacks these; react-aria + framer-motion touch them.
if (!window.matchMedia) {
  // @ts-ignore minimal stub
  window.matchMedia = (q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  });
}
if (!globalThis.ResizeObserver) {
  // @ts-ignore minimal stub
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
if (!globalThis.IntersectionObserver) {
  // @ts-ignore minimal stub — framer-motion useInView relies on it
  globalThis.IntersectionObserver = class {
    constructor(cb: any) { (this as any).cb = cb; }
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
}
```

- [ ] **Step 7: Write the smoke test `components/__tests__/smoke.test.tsx`**

Import the Button from the path the CLI created in Step 3 (adjust the import to match). Example assuming `@/components/base/buttons/button`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/base/buttons/button";

describe("untitled ui smoke", () => {
  it("renders a UU Button", () => {
    render(<Button>Sign up</Button>);
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Verify**

```bash
npm test
npx tsc --noEmit
```

Expected: the smoke test passes; tsc clean. If the Button import path is wrong, fix it to match where the CLI placed the component (read the file tree under `components/`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold pagecraft-site (Untitled UI + Next + Tailwind v4) with vitest harness"
```

---

## Task 2: Content layer (`lib/content.ts`)

**Files:** Create `lib/content.ts`; Test `lib/__tests__/content.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/content.test.ts
import { describe, it, expect } from "vitest";
import { NAV_LINKS, FEATURES, STEPS, STATS, TESTIMONIALS, PRICING_TIERS, LOGOS, HERO } from "@/lib/content";

describe("content", () => {
  it("has the marketing data the page needs", () => {
    expect(NAV_LINKS.length).toBeGreaterThanOrEqual(3);
    expect(FEATURES.length).toBe(6);
    expect(STEPS.length).toBe(3);
    expect(STATS.length).toBeGreaterThanOrEqual(3);
    expect(TESTIMONIALS.length).toBeGreaterThanOrEqual(2);
    expect(PRICING_TIERS.length).toBe(3);
    expect(LOGOS.length).toBeGreaterThanOrEqual(4);
    expect(HERO.headline).toMatch(/\w+/);
  });

  it("each pricing tier has a monthly and yearly price", () => {
    for (const t of PRICING_TIERS) {
      expect(typeof t.monthly).toBe("number");
      expect(typeof t.yearly).toBe("number");
      expect(t.features.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module '@/lib/content'`): `npx vitest run lib/__tests__/content.test.ts`

- [ ] **Step 3: Implement `lib/content.ts`**

```ts
export const HERO = {
  eyebrow: "New · v2 — see what's new",
  headline: "Build sites your way — drag, drop, publish.",
  subtitle:
    "Pagecraft is the visual website builder for teams who want pixel control without the code. Design responsive pages, manage content, and ship in one click.",
  primaryCta: { label: "Start building", href: "https://app.pagecraft.dev/signup" },
  secondaryCta: { label: "Watch demo", href: "#demo" },
} as const;

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
] as const;

export type Feature = { icon: string; title: string; text: string };
export const FEATURES: Feature[] = [
  { icon: "Cursor04", title: "Drag-and-drop blocks", text: "Compose pages from dozens of polished, responsive blocks — no code." },
  { icon: "Monitor04", title: "Per-breakpoint control", text: "Tune spacing, type and layout for every device, visually." },
  { icon: "Database01", title: "Built-in CMS", text: "Model collections and bind content to any block. Detail pages auto-generate." },
  { icon: "Rocket02", title: "One-click publish", text: "Ship to a fast, global edge. Preview, version, and roll back instantly." },
  { icon: "Stars02", title: "AI section generation", text: "Describe a section and get a polished draft you can fine-tune." },
  { icon: "Palette", title: "Shared design system", text: "Site-wide color tokens and text styles. Change once, update everywhere." },
];

export type Step = { title: string; text: string };
export const STEPS: Step[] = [
  { title: "Drag in blocks", text: "Start from a template or a blank canvas and drop in the blocks you need." },
  { title: "Tune per device", text: "Adjust styles per breakpoint with live visual controls." },
  { title: "Publish in one click", text: "Hit publish — your site goes live on the edge in seconds." },
];

export type Stat = { value: number; suffix: string; label: string };
export const STATS: Stat[] = [
  { value: 12000, suffix: "+", label: "Pages built" },
  { value: 40, suffix: "+", label: "Block types" },
  { value: 99.9, suffix: "%", label: "Uptime" },
  { value: 4.9, suffix: "/5", label: "Customer rating" },
];

export type Testimonial = { quote: string; name: string; role: string; initials: string };
export const TESTIMONIALS: Testimonial[] = [
  { quote: "We replaced three tools with Pagecraft and ship landing pages in an afternoon.", name: "Maya Chen", role: "Head of Growth, Northwind", initials: "MC" },
  { quote: "The per-breakpoint controls are the best I've used. Our designers never touch code now.", name: "Diego Ramos", role: "Design Lead, Lumen", initials: "DR" },
  { quote: "Publishing is genuinely one click. Our marketing team is fully self-serve.", name: "Aisha Okoro", role: "CMO, Bright Labs", initials: "AO" },
];

export type Tier = { name: string; monthly: number; yearly: number; blurb: string; features: string[]; featured?: boolean; cta: string };
export const PRICING_TIERS: Tier[] = [
  { name: "Free", monthly: 0, yearly: 0, blurb: "For trying things out.", cta: "Start free", features: ["1 site", "Pagecraft subdomain", "Core blocks", "Community support"] },
  { name: "Pro", monthly: 19, yearly: 15, blurb: "For solo builders & freelancers.", featured: true, cta: "Start free trial", features: ["5 sites", "Custom domains", "CMS + collections", "AI generation", "Remove branding"] },
  { name: "Team", monthly: 49, yearly: 39, blurb: "For teams shipping together.", cta: "Start free trial", features: ["Unlimited sites", "Shared design system", "Roles & permissions", "Priority support", "Audit log"] },
];

export const LOGOS = ["Northwind", "Lumen", "Bright Labs", "Acme", "Vertex", "Halcyon"] as const;

export const FOOTER = {
  product: [ { label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Changelog", href: "#" } ],
  resources: [ { label: "Docs", href: "#" }, { label: "Templates", href: "#" }, { label: "Blog", href: "#" } ],
  company: [ { label: "About", href: "#" }, { label: "Careers", href: "#" }, { label: "Contact", href: "#" } ],
} as const;
```

(Icon names are `@untitledui/icons` exports — Task 7 confirms the exact names and adjusts any that differ.)

- [ ] **Step 4: Run → PASS**; then `npx tsc --noEmit`. Commit:

```bash
git add lib/content.ts lib/__tests__/content.test.ts
git commit -m "feat: marketing content + data layer"
```

---

## Task 3: Motion helpers (`components/motion/`)

**Files:** Create `Reveal.tsx`, `CountUp.tsx`, `Tilt.tsx`; Test `components/motion/__tests__/motion.test.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { Tilt } from "@/components/motion/Tilt";

describe("motion helpers", () => {
  it("Reveal renders its children", () => {
    render(<Reveal><p>hello</p></Reveal>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Tilt renders its children", () => {
    render(<Tilt><span>card</span></Tilt>);
    expect(screen.getByText("card")).toBeInTheDocument();
  });

  it("CountUp renders a number toward its target (final value when reduced-motion/instant)", () => {
    render(<CountUp value={40} suffix="+" />);
    // The element exists and ends up showing the target + suffix.
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL.** `npx vitest run components/motion/__tests__/motion.test.tsx`

- [ ] **Step 3: Implement `components/motion/Reveal.tsx`**

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Fade/slide children in when scrolled into view (once). */
export function Reveal({ children, delay = 0, y = 16, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Implement `components/motion/CountUp.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** Counts from 0 to `value` when scrolled into view. Renders the final value immediately under reduced motion. */
export function CountUp({ value, suffix = "", durationMs = 1200, className }: { value: number; suffix?: string; durationMs?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const decimals = Number.isInteger(value) ? 0 : 1;

  useEffect(() => {
    if (reduce) { setN(value); return; }
    if (!inView) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value, durationMs]);

  const display = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span ref={ref} className={className}>{display}{suffix}</span>;
}
```

Note: in jsdom `requestAnimationFrame` may not fire and `useInView` won't trigger, so the test only asserts the suffix renders. Under reduced motion the final value renders synchronously. Both are covered.

- [ ] **Step 5: Implement `components/motion/Tilt.tsx`**

```tsx
"use client";
import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

/** Subtle pointer-driven tilt on hover. No-op under reduced motion. */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 20 });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { px.set(0); py.set(0); }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 6: Run → PASS** (`npx vitest run components/motion/__tests__/motion.test.tsx`); `npx tsc --noEmit`. Commit:

```bash
git add components/motion lib
git commit -m "feat: reusable motion helpers (Reveal, CountUp, Tilt)"
```

---

## Task 4: Nav (sticky, scroll-state)

**Files:** Create `components/sections/Nav.tsx`; Test `components/sections/__tests__/Nav.test.tsx`. (Visual polish: invoke frontend-design.)

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "@/components/sections/Nav";

describe("Nav", () => {
  it("renders the brand, anchor links, and auth CTAs", () => {
    render(<Nav />);
    expect(screen.getByText("Pagecraft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (skeleton — polish with frontend-design). Uses a scroll listener to toggle a solid/blur state.

```tsx
"use client";
import { useEffect, useState } from "react";
import { cx } from "@/utils/cx";
import { NAV_LINKS } from "@/lib/content";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cx("sticky top-0 z-50 transition-colors", scrolled && "border-b border-gray-200 bg-white/80 backdrop-blur")}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight text-gray-900">
          <span className="size-7 rounded-lg bg-brand-600" aria-hidden />
          <span>Pagecraft</span>
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-gray-900">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="https://app.pagecraft.dev/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900">Log in</a>
          <a href="https://app.pagecraft.dev/signup" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">Sign up</a>
        </div>
      </nav>
    </header>
  );
}
```

(Use the UU `Button` component for the CTAs if its API renders an `<a>`/link variant; the test only needs accessible `link` roles named "Log in"/"Sign up". The `bg-brand-600` token comes from the UU theme chosen in Task 1 — confirm the brand color class name from `styles/theme.css` and adjust if it differs.)

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit`. Commit:

```bash
git add components/sections/Nav.tsx components/sections/__tests__/Nav.test.tsx
git commit -m "feat(section): Nav with scroll-state"
```

---

## Task 5: Hero

**Files:** Create `components/sections/Hero.tsx`; Test `components/sections/__tests__/Hero.test.tsx`. (Polish: frontend-design.)

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "@/components/sections/Hero";
import { HERO } from "@/lib/content";

describe("Hero", () => {
  it("renders the headline and both CTAs", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { name: HERO.headline })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: HERO.primaryCta.label })).toHaveAttribute("href", HERO.primaryCta.href);
    expect(screen.getByRole("link", { name: HERO.secondaryCta.label })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (skeleton — polish with frontend-design; renders the eyebrow Badge pill, headline, subtitle, two CTAs, the faint grid background, and the `EditorMock` below overlapping the hero bottom).

```tsx
import { EditorMock } from "@/components/product-mock/EditorMock";
import { Reveal } from "@/components/motion/Reveal";
import { HERO } from "@/lib/content";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* faint grid background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,theme(colors.gray.200)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.gray.200)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="relative mx-auto max-w-4xl px-6 pt-24 text-center">
        <Reveal>
          <a href="#changelog" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-xs">
            <span className="size-1.5 rounded-full bg-brand-600" /> {HERO.eyebrow} →
          </a>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">{HERO.headline}</h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">{HERO.subtitle}</p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a href={HERO.secondaryCta.href} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-xs hover:bg-gray-50">▷ {HERO.secondaryCta.label}</a>
            <a href={HERO.primaryCta.href} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700">{HERO.primaryCta.label}</a>
          </div>
        </Reveal>
      </div>
      <div className="relative mx-auto mt-16 max-w-6xl px-6">
        <EditorMock />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit`. Commit:

```bash
git add components/sections/Hero.tsx components/sections/__tests__/Hero.test.tsx
git commit -m "feat(section): Hero with grid background + CTAs"
```

---

## Task 6: EditorMock (signature animated product mock)

**Files:** Create `components/product-mock/EditorMock.tsx`; Test `components/product-mock/__tests__/EditorMock.test.tsx`.

- [ ] **Step 1: Failing test** (mounts without crashing; shows recognizable editor chrome)

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorMock } from "@/components/product-mock/EditorMock";

describe("EditorMock", () => {
  it("mounts and shows the editor chrome (sidebar blocks + canvas)", () => {
    render(<EditorMock />);
    expect(screen.getByText("Hero")).toBeInTheDocument();   // a sidebar block chip
    expect(screen.getByText(/pagecraft\.app/i)).toBeInTheDocument(); // faux URL bar
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (the looping drag animation is gated by reduced motion; structure is a browser frame → sidebar + topbar + canvas; a cursor + ghost chip animate the drag-in loop)

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

const CHIPS = ["Hero", "Text", "Image", "Button", "Columns"];

export function EditorMock() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
      {/* browser top bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className="size-3 rounded-full bg-red-400" />
        <span className="size-3 rounded-full bg-amber-400" />
        <span className="size-3 rounded-full bg-green-400" />
        <span className="ml-3 rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-500">pagecraft.app/editor</span>
      </div>
      <div className="grid grid-cols-[180px_1fr]">
        {/* sidebar */}
        <div className="border-r border-gray-100 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Blocks</p>
          <div className="space-y-1.5">
            {CHIPS.map((c) => (
              <div key={c} className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700">{c}</div>
            ))}
          </div>
        </div>
        {/* canvas */}
        <div className="relative min-h-[320px] bg-gray-50/60 p-4">
          <div className="space-y-3">
            <div className="h-20 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
            <div className="h-8 w-28 rounded-lg bg-brand-600" />
            {/* the block that animates in on the drop */}
            <motion.div
              className="h-16 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
              animate={reduce ? { opacity: 1 } : { opacity: [0, 0, 1], scale: [0.96, 0.96, 1] }}
              transition={reduce ? undefined : { duration: 4, times: [0, 0.6, 0.8], repeat: Infinity, repeatDelay: 1 }}
            />
          </div>
          {/* dragging cursor + ghost chip */}
          {!reduce && (
            <motion.div
              className="pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-2"
              initial={{ x: -120, y: 40, opacity: 0 }}
              animate={{ x: [-120, 60, 60, 60], y: [40, 40, 230, 230], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 4, times: [0, 0.4, 0.75, 0.85], repeat: Infinity, repeatDelay: 1 }}
            >
              <span className="rounded-md border border-brand-300 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 shadow-md">Columns</span>
              <span className="size-4 rotate-12 rounded-sm bg-gray-900/80" />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit`. Commit:

```bash
git add components/product-mock components/sections/__tests__ 2>/dev/null; git add components/product-mock
git commit -m "feat: animated EditorMock (hero product centerpiece)"
```

---

## Task 7: LogoCloud + Features

**Files:** Create `components/sections/LogoCloud.tsx`, `components/sections/Features.tsx`; Test `components/sections/__tests__/Features.test.tsx`. (Polish: frontend-design.)

- [ ] **Step 1: Confirm icon names** — Features uses `@untitledui/icons`. Run a quick check that the icon names in `lib/content.ts` (`Cursor04`, `Monitor04`, `Database01`, `Rocket02`, `Stars02`, `Palette`) exist:

```bash
node -e "const i=require('@untitledui/icons'); console.log(['Cursor04','Monitor04','Database01','Rocket02','Stars02','Palette'].map(n=>n+':'+(n in i)))"
```

For any that print `false`, pick the nearest real export (inspect with `node -e "console.log(Object.keys(require('@untitledui/icons')).slice(0,50))"`) and update `lib/content.ts`. Commit any content fix with the section.

- [ ] **Step 2: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Features } from "@/components/sections/Features";
import { FEATURES } from "@/lib/content";

describe("Features", () => {
  it("renders a card per feature", () => {
    render(<Features />);
    for (const f of FEATURES) expect(screen.getByText(f.title)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run → FAIL, then implement both.** `LogoCloud.tsx` (skeleton):

```tsx
import { LOGOS } from "@/lib/content";

export function LogoCloud() {
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <p className="text-center text-sm font-medium text-gray-500">Trusted by teams at</p>
      <div className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-6 px-6 opacity-70">
        {LOGOS.map((l) => (
          <span key={l} className="text-lg font-semibold tracking-tight text-gray-400">{l}</span>
        ))}
      </div>
    </section>
  );
}
```

`Features.tsx` (skeleton — maps icons dynamically from `@untitledui/icons`, wraps each card in `Tilt` + `Reveal`):

```tsx
"use client";
import * as Icons from "@untitledui/icons";
import { Tilt } from "@/components/motion/Tilt";
import { Reveal } from "@/components/motion/Reveal";
import { FEATURES } from "@/lib/content";

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything you need to ship</h2>
        <p className="mt-4 text-lg text-gray-600">A complete visual builder — from first block to published site.</p>
      </div>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[f.icon] ?? Icons.Star01;
          return (
            <Reveal key={f.title} delay={i * 0.04}>
              <Tilt className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.text}</p>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit`. Commit:

```bash
git add components/sections/LogoCloud.tsx components/sections/Features.tsx components/sections/__tests__/Features.test.tsx lib/content.ts
git commit -m "feat(section): LogoCloud + Features (tilt cards)"
```

---

## Task 8: HowItWorks + Stats

**Files:** Create `components/sections/HowItWorks.tsx`, `components/sections/Stats.tsx`; Test `components/sections/__tests__/Stats.test.tsx`. (Polish: frontend-design.)

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stats } from "@/components/sections/Stats";
import { STATS } from "@/lib/content";

describe("Stats", () => {
  it("renders a label per stat", () => {
    render(<Stats />);
    for (const s of STATS) expect(screen.getByText(s.label)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL, then implement.** `HowItWorks.tsx` (skeleton):

```tsx
import { Reveal } from "@/components/motion/Reveal";
import { STEPS } from "@/lib/content";

export function HowItWorks() {
  return (
    <section id="how" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">From idea to live in three steps</h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

`Stats.tsx` (skeleton — uses `CountUp`):

```tsx
import { CountUp } from "@/components/motion/CountUp";
import { STATS } from "@/lib/content";

export function Stats() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-4xl font-bold tracking-tight text-gray-900">
              <CountUp value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-1 text-sm text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run → PASS**; `npx tsc --noEmit`. Commit:

```bash
git add components/sections/HowItWorks.tsx components/sections/Stats.tsx components/sections/__tests__/Stats.test.tsx
git commit -m "feat(section): HowItWorks + Stats (count-up)"
```

---

## Task 9: Testimonials + Pricing (animated toggle)

**Files:** Create `components/sections/Testimonials.tsx`, `components/sections/Pricing.tsx`; Test `components/sections/__tests__/Pricing.test.tsx`.

- [ ] **Step 1: Failing test** (the toggle is the logic-bearing part — test it for real with user-event)

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pricing } from "@/components/sections/Pricing";

describe("Pricing", () => {
  it("flips prices between monthly and yearly", async () => {
    render(<Pricing />);
    // Pro tier monthly = $19, yearly = $15 (per lib/content)
    expect(screen.getByText("$19")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText("$15")).toBeInTheDocument();
    expect(screen.queryByText("$19")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL, then implement.** `Testimonials.tsx` (skeleton):

```tsx
import { Reveal } from "@/components/motion/Reveal";
import { TESTIMONIALS } from "@/lib/content";

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Loved by modern teams</h2>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.05}>
            <figure className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <blockquote className="text-gray-800">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{t.initials}</span>
                <span><span className="block text-sm font-semibold text-gray-900">{t.name}</span><span className="block text-xs text-gray-500">{t.role}</span></span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

`Pricing.tsx` (the toggle is real logic; the cards are skeleton — polish with frontend-design):

```tsx
"use client";
import { useState } from "react";
import { cx } from "@/utils/cx";
import { PRICING_TIERS } from "@/lib/content";

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Simple, transparent pricing</h2>
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1">
            <button type="button" onClick={() => setYearly(false)} className={cx("rounded-full px-4 py-1.5 text-sm font-medium", !yearly ? "bg-brand-600 text-white" : "text-gray-600")}>Monthly</button>
            <button type="button" onClick={() => setYearly(true)} className={cx("rounded-full px-4 py-1.5 text-sm font-medium", yearly ? "bg-brand-600 text-white" : "text-gray-600")}>Yearly <span className="text-xs opacity-80">save 20%</span></button>
          </div>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-3">
          {PRICING_TIERS.map((t) => (
            <div key={t.name} className={cx("rounded-2xl border bg-white p-6 shadow-xs", t.featured ? "border-brand-300 ring-2 ring-brand-100" : "border-gray-200")}>
              <h3 className="font-semibold text-gray-900">{t.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{t.blurb}</p>
              <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900">${yearly ? t.yearly : t.monthly}<span className="text-base font-normal text-gray-500">/mo</span></p>
              <a href="https://app.pagecraft.dev/signup" className={cx("mt-5 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold", t.featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-gray-300 text-gray-800 hover:bg-gray-50")}>{t.cta}</a>
              <ul className="mt-6 space-y-2 text-sm text-gray-600">
                {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-brand-600">✓</span>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run → PASS** (the toggle test must actually flip $19→$15); `npx tsc --noEmit`. Commit:

```bash
git add components/sections/Testimonials.tsx components/sections/Pricing.tsx components/sections/__tests__/Pricing.test.tsx
git commit -m "feat(section): Testimonials + Pricing with animated toggle"
```

---

## Task 10: FinalCTA + Footer + compose the page

**Files:** Create `components/sections/FinalCTA.tsx`, `components/sections/Footer.tsx`; Modify `app/page.tsx`. (Polish: frontend-design.)

- [ ] **Step 1: Implement `FinalCTA.tsx`** (skeleton):

```tsx
export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="overflow-hidden rounded-3xl bg-gray-900 px-8 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Start building your site today</h2>
        <p className="mx-auto mt-3 max-w-xl text-gray-300">No code. No limits. Publish your first page in minutes.</p>
        <a href="https://app.pagecraft.dev/signup" className="mt-8 inline-block rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Start building free</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `Footer.tsx`** (skeleton, uses `FOOTER` from content):

```tsx
import { FOOTER } from "@/lib/content";

export function Footer() {
  const cols: [string, readonly { label: string; href: string }[]][] = [
    ["Product", FOOTER.product], ["Resources", FOOTER.resources], ["Company", FOOTER.company],
  ];
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold text-gray-900"><span className="size-7 rounded-lg bg-brand-600" aria-hidden /> Pagecraft</div>
          <p className="mt-3 max-w-xs text-sm text-gray-500">The visual website builder for teams.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <ul className="mt-3 space-y-2">
              {links.map((l) => <li key={l.label}><a href={l.href} className="text-sm text-gray-600 hover:text-gray-900">{l.label}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">© 2026 Pagecraft. All rights reserved.</div>
    </footer>
  );
}
```

- [ ] **Step 3: Compose `app/page.tsx`** (replace the scaffold's default content entirely):

```tsx
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { LogoCloud } from "@/components/sections/LogoCloud";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Stats } from "@/components/sections/Stats";
import { Testimonials } from "@/components/sections/Testimonials";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="bg-white">
      <Nav />
      <Hero />
      <LogoCloud />
      <Features />
      <HowItWorks />
      <Stats />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit` + `npm test` (all section tests pass). Commit:

```bash
git add components/sections/FinalCTA.tsx components/sections/Footer.tsx app/page.tsx
git commit -m "feat: FinalCTA, Footer, and full page composition"
```

---

## Task 11: Metadata / SEO + globals + build gate

**Files:** Modify `app/layout.tsx`, `app/globals.css`; Create `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`.

- [ ] **Step 1: Metadata in `app/layout.tsx`** — add/extend the exported `metadata`:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://pagecraft.dev"),
  title: "Pagecraft — Build sites your way",
  description: "The visual website builder for teams. Design responsive pages, manage content, and publish in one click.",
  openGraph: {
    title: "Pagecraft — Build sites your way",
    description: "Design responsive pages, manage content, and publish in one click.",
    url: "https://pagecraft.dev",
    siteName: "Pagecraft",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Pagecraft", description: "Build sites your way — drag, drop, publish." },
};
```

(Keep the scaffold's `<html>/<body>` + font setup; only add/merge the `metadata` export.)

- [ ] **Step 2: `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://pagecraft.dev/sitemap.xml" };
}
```

- [ ] **Step 3: `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://pagecraft.dev", changeFrequency: "weekly", priority: 1 }];
}
```

- [ ] **Step 4: `app/opengraph-image.tsx`** (generated OG image via next/og)

```tsx
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "white", fontSize: 72, fontWeight: 700 }}>
        <div>Pagecraft</div>
        <div style={{ fontSize: 32, fontWeight: 400, marginTop: 16, color: "#a3a3a3" }}>Build sites your way — drag, drop, publish.</div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 5: `app/globals.css`** — append a reduced-motion guard (the grid background is inline in Hero, so just the global motion guard here):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 6: Full gate**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: tsc clean; all tests pass; `next build` succeeds (compiles every section, the OG route, sitemap, robots). If the build flags a server/client boundary issue (e.g. a section using hooks without `"use client"`), add the directive to that file and rebuild. If `opengraph-image` edge runtime errors, switch `runtime` to `"nodejs"`.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/globals.css app/sitemap.ts app/robots.ts app/opengraph-image.tsx
git commit -m "feat: SEO metadata, sitemap, robots, OG image, reduced-motion guard"
```

---

## Self-Review

**Spec coverage:**
- Standalone Next.js + Tailwind v4 at `~/Desktop/projects/pagecraft-site` → Task 1 ✓
- Real Untitled UI React (CLI init + `add` base components) → Task 1 ✓
- framer-motion interactions → Task 3 (helpers) + used throughout ✓
- Single landing page with all 10 sections → Tasks 4–10 ✓
- Signature interactions: animated EditorMock (Task 6), scroll-reveal (Reveal, Task 3), count-up stats (CountUp+Stats, Tasks 3/8), pricing toggle (Task 9), hover-tilt cards (Tilt+Features, Tasks 3/7), nav scroll-state (Task 4) ✓
- Bespoke editor mock as hero centerpiece → Task 6, placed by Hero (Task 5) ✓
- Content in `lib/content.ts` → Task 2 ✓
- SEO/OG/sitemap/robots → Task 11 ✓
- prefers-reduced-motion on every animation → handled in each motion helper + EditorMock + globals guard ✓
- Testing: smoke/behavior tests for logic-bearing units; gate `tsc` + `next build` → each task + Task 11 ✓

**Placeholder scan:** No "TBD"/"implement later". Presentational sections have complete, compiling skeleton code + a real test; the "polish with frontend-design" notes are an explicit, intended delegation of *visual craft* (stated up front), not missing implementation. Commands have expected output. The few "confirm/adjust" steps (UU paths, icon names, brand-color class, `@/` alias) are grounded verifications with exact fallback commands, because they depend on the external CLI's output.

**Type consistency:** `lib/content.ts` exports (`HERO`, `NAV_LINKS`, `FEATURES`, `STEPS`, `STATS`, `TESTIMONIALS`, `PRICING_TIERS`, `LOGOS`, `FOOTER`) are defined in Task 2 and consumed with matching names/shapes in Tasks 4–10. `Reveal`/`CountUp`/`Tilt` prop signatures defined in Task 3 match their usages. `cx` (not `cn`) used consistently per the scaffold. `Tier.monthly`/`yearly` (numbers) drive the Pricing toggle test ($19↔$15).
