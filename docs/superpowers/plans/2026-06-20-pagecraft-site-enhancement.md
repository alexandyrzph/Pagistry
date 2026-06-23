# Pagistry Site Cinematic Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NO TESTS** (project standing decision for this landing page). The gate is `npx tsc --noEmit` (0 errors) + `npm run build` (must stay green). There is no TDD here.
>
> **VISUAL CRAFT NOTE:** This is a marketing site. For the presentational new sections (Phase 5: bento Features, TemplateGallery, UseCases, Comparison, FAQ), the implementing subagent SHOULD invoke the **frontend-design** skill to elevate the compiling skeletons here into distinctive, polished UI cohesive with the existing site. The motion/WebGL/showcase logic (Phases 1–4) is fully specified.

**Goal:** Elevate the existing Pagistry landing page to an award-tier, alive feel: smooth scroll, parallax depth, a WebGL hero, a pinned scroll-scrub product showcase, magnetic CTAs, and new product-focused content sections — without hurting load performance or accessibility.

**Architecture:** Add GSAP+ScrollTrigger+Lenis (scroll choreography) and Three.js/R3F (WebGL hero) alongside the existing framer-motion. A `useMotionEnv` hook gates everything heavy by reduced-motion + mobile/low-power. WebGL is `ssr:false`-dynamic and lazy-mounted so the static build and LCP are unaffected.

**Tech Stack:** Next 16 (App Router, Turbopack), React 19.2, Tailwind v4, Untitled UI, framer-motion 12, **gsap 3.15 + @gsap/react + gsap/ScrollTrigger**, **lenis 1.3 (`lenis/react`)**, **three + @react-three/fiber 9 + @react-three/drei 10**.

**Spec:** `docs/superpowers/specs/2026-06-20-pagistry-site-enhancement-design.md` (dnd-pagebuilder repo).

**CRITICAL — this builds in the EXTERNAL repo `~/Desktop/projects/pagistry-site`.** Every npm/git command runs there: start each Bash command with `cd ~/Desktop/projects/pagistry-site`. The project is **`src/`-based** (`@/` → `./src`). className util is **`cx` from `@/utils/cx`**. Brand tokens are UU violet (`bg-brand-600`, etc.). framer-motion, content (`@/lib/content`), and the existing sections + `EditorMock` already exist.

---

## File Structure (created/modified in `~/Desktop/projects/pagistry-site`)

**Create:**

- `src/lib/motion/env.ts` — `useMotionEnv()` gating hook.
- `src/components/motion/SmoothScroll.tsx` — Lenis + GSAP ticker/ScrollTrigger provider (reduced-motion bypass).
- `src/lib/motion/useParallax.ts` — ScrollTrigger parallax hook.
- `src/components/webgl/HeroScene.tsx` — R3F scene (drifting blocks + shader gradient).
- `src/components/webgl/HeroSceneFallback.tsx` — static CSS backdrop.
- `src/components/webgl/HeroBackdrop.tsx` — client wrapper: dynamic `ssr:false` + gating + fallback.
- `src/components/sections/ProductShowcase.tsx` — pinned scroll-scrub centerpiece.
- `src/components/sections/TemplateGallery.tsx`, `UseCases.tsx`, `Comparison.tsx`, `FAQ.tsx` — new content sections.
- `src/components/ui/MagneticButton.tsx` — magnetic CTA wrapper.

**Modify:**

- `src/app/layout.tsx` — wrap children in `SmoothScroll`.
- `src/components/sections/Hero.tsx` — mount `HeroBackdrop`; wrap mock in 3D tilt.
- `src/components/sections/Features.tsx` — rework to a bento grid.
- `src/components/sections/Stats.tsx`, `Testimonials.tsx` — add parallax.
- `src/lib/content.ts` — add `SHOWCASE_STEPS`, `TEMPLATES`, `USE_CASES`, `COMPARISON`, `FAQ`.
- `src/app/page.tsx` — recompose with new sections.

---

## Task 1 (Phase 1): Motion foundation — deps, env gating, smooth scroll, parallax

**Files:** install deps; Create `src/lib/motion/env.ts`, `src/components/motion/SmoothScroll.tsx`, `src/lib/motion/useParallax.ts`; Modify `src/app/layout.tsx`, `src/components/sections/Stats.tsx`.

- [ ] **Step 1: Install deps**

```bash
cd ~/Desktop/projects/pagistry-site
npm install gsap @gsap/react lenis three @react-three/fiber @react-three/drei
npm install -D @types/three
```

Expected: installs cleanly. Versions should resolve to `@react-three/fiber@^9`, `@react-three/drei@^10`, `gsap@^3.15`, `lenis@^1.3`, `three@^0.17x`. If `@react-three/fiber` resolves below 9, run `npm install @react-three/fiber@^9 @react-three/drei@^10` explicitly (v9 is the React 19 line). If any peer-dep error mentions React 18, add `--legacy-peer-deps` and note it in the report.

- [ ] **Step 2: `src/lib/motion/env.ts`** — single source of truth for motion gating

```ts
"use client";
import { useEffect, useState } from "react";

export type MotionEnv = { reducedMotion: boolean; isMobile: boolean; allowWebgl: boolean };

/**
 * SSR-safe motion gating. Returns conservative defaults on the server / first
 * paint (no heavy motion), then resolves real values after mount so nothing
 * heavy runs before we know the environment.
 */
export function useMotionEnv(): MotionEnv {
  const [env, setEnv] = useState<MotionEnv>({
    reducedMotion: true,
    isMobile: true,
    allowWebgl: false,
  });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = window.innerWidth < 768;
    const isMobile = coarse || small;
    const lowPower =
      typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
    const allowWebgl = !reduce && !isMobile && !lowPower;
    setEnv({ reducedMotion: reduce, isMobile, allowWebgl });
  }, []);

  return env;
}
```

- [ ] **Step 3: `src/components/motion/SmoothScroll.tsx`** — Lenis + GSAP, reduced-motion bypass

```tsx
"use client";
import { type ReactNode, useEffect, useRef } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionEnv } from "@/lib/motion/env";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const { reducedMotion } = useMotionEnv();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    lenis?.on("scroll", ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(update);
      lenis?.off("scroll", ScrollTrigger.update);
    };
  }, [reducedMotion]);

  // Under reduced motion, skip Lenis entirely — native scroll.
  if (reducedMotion) return <>{children}</>;

  return (
    <ReactLenis root options={{ autoRaf: false, smoothWheel: true }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}
```

Note: confirm the `lenis/react` exports `ReactLenis` and a `LenisRef` type exposing `.lenis`. If the type name differs, read `node_modules/lenis/react/...d.ts` and use the actual ref type (the ref's `.lenis` instance is what `raf`/`on` are called on). If `autoRaf: false` isn't accepted, omit it and instead let Lenis self-raf and only wire `lenis.on("scroll", ScrollTrigger.update)`.

- [ ] **Step 4: Wrap the app in `src/app/layout.tsx`**

Import and wrap the existing children (keep the `RouteProvider`/`Theme` providers):

```tsx
import { SmoothScroll } from "@/components/motion/SmoothScroll";
```

Inside the body, wrap the existing provider tree's children so the structure becomes:

```tsx
<RouteProvider>
  <Theme>
    <SmoothScroll>{children}</SmoothScroll>
  </Theme>
</RouteProvider>
```

- [ ] **Step 5: `src/lib/motion/useParallax.ts`** — reusable ScrollTrigger parallax

```ts
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionEnv } from "@/lib/motion/env";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP as never);

/** Parallax-translate an element on scroll. `speed` > 0 moves slower (depth). No-op under reduced motion. */
export function useParallax<T extends HTMLElement>(speed = 40) {
  const ref = useRef<T>(null);
  const { reducedMotion } = useMotionEnv();
  useGSAP(
    () => {
      if (reducedMotion || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { y: -speed },
        {
          y: speed,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { dependencies: [reducedMotion] },
  );
  return ref;
}
```

(If `gsap.registerPlugin(... useGSAP ...)` errors — `useGSAP` is a hook, not a plugin — drop it from `registerPlugin` and only register `ScrollTrigger`. The line is defensive; remove if it complains.)

- [ ] **Step 6: Prove the pipeline — add parallax to Stats**

In `src/components/sections/Stats.tsx`, import `useParallax` and attach its ref to a decorative background layer (e.g. the section's radial-glow div, NOT the text — keep numbers readable). Minimal wiring example: add a `const glowRef = useParallax<HTMLDivElement>(30);` and put `ref={glowRef}` on the existing background glow element. Make Stats a client component (`"use client"`) if it isn't already.

- [ ] **Step 7: Verify & commit**

```bash
cd ~/Desktop/projects/pagistry-site
npx tsc --noEmit            # expect 0 errors
npm run build               # expect success (static build green)
git add -A && git commit -m "feat(motion): Lenis+GSAP smooth scroll, motion-env gating, parallax helper"
```

If `npm run build` fails on a Lenis/GSAP server-import, ensure `SmoothScroll`, `env.ts`, `useParallax.ts` all carry `"use client"` and that no server component imports them at module top level outside a client boundary. Fix and rebuild.

---

## Task 2 (Phase 2): WebGL hero (Three.js / R3F) + 3D-tilt product card

**Files:** Create `src/components/webgl/HeroScene.tsx`, `HeroSceneFallback.tsx`, `HeroBackdrop.tsx`; Modify `src/components/sections/Hero.tsx`.

- [ ] **Step 1: `src/components/webgl/HeroSceneFallback.tsx`** — static backdrop (also the pre-load placeholder)

```tsx
export function HeroSceneFallback() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-[120px]" />
      <div className="absolute right-1/4 top-40 h-[400px] w-[400px] rounded-full bg-violet-300/30 blur-[100px]" />
    </div>
  );
}
```

- [ ] **Step 2: `src/components/webgl/HeroScene.tsx`** — R3F drifting blocks + gradient

```tsx
"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const BLOCK_COUNT = 14;

function Blocks() {
  const group = useRef<THREE.Group>(null);
  const blocks = useMemo(
    () =>
      Array.from({ length: BLOCK_COUNT }, (_, i) => ({
        pos: [Math.sin(i * 1.7) * 6, Math.cos(i * 2.3) * 3.5, -2 - (i % 5)] as [
          number,
          number,
          number,
        ],
        scale: 0.5 + (i % 4) * 0.18,
        speed: 0.15 + (i % 5) * 0.05,
        hue: i % 3,
      })),
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((m, i) => {
      m.position.y += Math.sin(t * blocks[i].speed + i) * 0.0025;
      m.rotation.x = Math.sin(t * 0.1 + i) * 0.2;
      m.rotation.y = Math.cos(t * 0.12 + i) * 0.2;
    });
    // subtle pointer parallax
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      state.pointer.x * 0.15,
      0.04,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -state.pointer.y * 0.1,
      0.04,
    );
  });
  const colors = ["#a78bfa", "#c4b5fd", "#7c3aed"];
  return (
    <group ref={group}>
      {blocks.map((b, i) => (
        <RoundedBox
          key={i}
          args={[1, 1, 1]}
          radius={0.16}
          smoothness={3}
          position={b.pos}
          scale={b.scale}
        >
          <meshStandardMaterial
            color={colors[b.hue]}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </RoundedBox>
      ))}
    </group>
  );
}

function Rig() {
  const { camera } = useThree();
  camera.position.set(0, 0, 9);
  return null;
}

export default function HeroScene() {
  return (
    <Canvas
      aria-hidden
      className="!absolute inset-0 -z-10"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 45 }}
    >
      <Rig />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Blocks />
    </Canvas>
  );
}
```

Note: `export default` is required for `next/dynamic`. Confirm `RoundedBox` is exported by the installed `@react-three/drei` (it is in v10); if tree-shaking/import errors occur, replace `RoundedBox` with a plain `<mesh><boxGeometry/><meshStandardMaterial/></mesh>`.

- [ ] **Step 3: `src/components/webgl/HeroBackdrop.tsx`** — gated dynamic mount

```tsx
"use client";
import dynamic from "next/dynamic";
import { useMotionEnv } from "@/lib/motion/env";
import { HeroSceneFallback } from "./HeroSceneFallback";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <HeroSceneFallback />,
});

export function HeroBackdrop() {
  const { allowWebgl } = useMotionEnv();
  if (!allowWebgl) return <HeroSceneFallback />;
  return <HeroScene />;
}
```

- [ ] **Step 4: Mount in `src/components/sections/Hero.tsx`**

- Add `import { HeroBackdrop } from "@/components/webgl/HeroBackdrop";` and render `<HeroBackdrop />` as the first child of the hero `<section>` (it positions absolute `-z-10`, behind the existing grid + content). Keep the existing grid background (it layers above the WebGL, below the text).
- Wrap the existing `<EditorMock />` in the existing `Tilt` component for a pointer 3D tilt: `import { Tilt } from "@/components/motion/Tilt";` then `<Tilt className="..."><EditorMock /></Tilt>` (Tilt already no-ops under reduced motion). Use a modest `max` (e.g. `max={5}`).

- [ ] **Step 5: Verify & commit**

```bash
cd ~/Desktop/projects/pagistry-site
npx tsc --noEmit            # 0 errors
npm run build               # MUST stay green — the WebGL is ssr:false dynamic, so it must not appear in the static/server bundle
git add -A && git commit -m "feat(webgl): R3F hero backdrop (drifting blocks) + static fallback + 3D-tilt mock"
```

If `next build` fails citing `three`/`window`/`self is not defined` in SSR, the dynamic `ssr:false` boundary is being bypassed — ensure `HeroScene` is ONLY imported via the `dynamic(() => import("./HeroScene"), { ssr:false })` in `HeroBackdrop`, never imported directly anywhere, and that `HeroBackdrop` is the only thing `Hero.tsx` imports.

---

## Task 3 (Phase 3): Pinned scroll-scrub Product Showcase (centerpiece)

**Files:** Modify `src/lib/content.ts`; Create `src/components/sections/ProductShowcase.tsx`.

- [ ] **Step 1: Add `SHOWCASE_STEPS` to `src/lib/content.ts`**

```ts
export type ShowcaseStep = { kicker: string; title: string; text: string };
export const SHOWCASE_STEPS: ShowcaseStep[] = [
  {
    kicker: "Design",
    title: "Visual, not code",
    text: "Drag polished blocks onto the canvas. What you see is exactly what ships — no markup, no fiddling.",
  },
  {
    kicker: "Responsive",
    title: "Per-breakpoint control",
    text: "Tune spacing, type and layout for every device with live visual controls — not media-query guesswork.",
  },
  {
    kicker: "Content",
    title: "Bind real data",
    text: "Model collections and bind them to any block. Detail pages generate themselves from your content.",
  },
  {
    kicker: "Ship",
    title: "Publish in one click",
    text: "Push to a fast global edge in seconds. Preview, version, and roll back without a deploy pipeline.",
  },
];
```

- [ ] **Step 2: `src/components/sections/ProductShowcase.tsx`** — pin the mock, scrub the steps

```tsx
"use client";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cx } from "@/utils/cx";
import { EditorMock } from "@/components/product-mock/EditorMock";
import { SHOWCASE_STEPS } from "@/lib/content";
import { useMotionEnv } from "@/lib/motion/env";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export function ProductShowcase() {
  const root = useRef<HTMLDivElement>(null);
  const pinTarget = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { reducedMotion } = useMotionEnv();

  useGSAP(
    () => {
      if (reducedMotion || !root.current || !pinTarget.current) return;
      const steps = SHOWCASE_STEPS.length;
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: () => `+=${steps * 100}%`,
        pin: pinTarget.current,
        scrub: true,
        onUpdate: (self) => setActive(Math.min(steps - 1, Math.floor(self.progress * steps))),
      });
      return () => st.kill();
    },
    { dependencies: [reducedMotion] },
  );

  // Reduced motion: a plain stacked, non-pinned version of the same content.
  if (reducedMotion) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          How Pagistry is different
        </h2>
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div className="space-y-8">
            {SHOWCASE_STEPS.map((s) => (
              <div key={s.title}>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {s.kicker}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
          <EditorMock />
        </div>
      </section>
    );
  }

  return (
    <section ref={root} id="how" className="relative">
      <div ref={pinTarget} className="flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How Pagistry is different
            </h2>
            <div className="relative mt-8 h-44">
              {SHOWCASE_STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className={cx(
                    "absolute inset-0 transition-all duration-500",
                    i === active
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-3 opacity-0",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {s.kicker}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-lg text-gray-600">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              {SHOWCASE_STEPS.map((s, i) => (
                <span
                  key={s.title}
                  className={cx(
                    "h-1.5 rounded-full transition-all",
                    i === active ? "w-8 bg-brand-600" : "w-4 bg-gray-200",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <EditorMock />
          </div>
        </div>
      </div>
    </section>
  );
}
```

Note: the pinned wrapper gives the section a scroll length of `steps * 100%`; `onUpdate` maps scroll progress → active step. The `EditorMock` here is the same component used in the hero (fine to reuse). Verify pinning doesn't fight Lenis — it shouldn't (ScrollTrigger.update is wired to Lenis in Task 1). If the pin "jumps", add `anticipatePin: 1` to the `ScrollTrigger.create` options.

- [ ] **Step 3: Verify & commit**

```bash
cd ~/Desktop/projects/pagistry-site
npx tsc --noEmit            # 0 errors
npm run build               # green
git add -A && git commit -m "feat(section): pinned scroll-scrub Product Showcase (+ reduced-motion fallback)"
```

---

## Task 4 (Phase 4): Parallax/scrub pass + magnetic CTAs

**Files:** Create `src/components/ui/MagneticButton.tsx`; Modify `src/components/sections/Testimonials.tsx` (+ optionally Hero layers).

- [ ] **Step 1: `src/components/ui/MagneticButton.tsx`** — pointer-follow magnetic wrapper

```tsx
"use client";
import { type ReactNode, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/** Wraps a link/button so it subtly follows the pointer. No-op under reduced motion / touch. */
export function MagneticButton({
  children,
  className,
  strength = 0.3,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: "inline-block" }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
```

Apply it around the primary CTA in `Hero.tsx` and `FinalCTA.tsx` (wrap the existing `<a>` in `<MagneticButton>`). Keep the anchor itself unchanged inside.

- [ ] **Step 2: Add parallax to Testimonials**

In `src/components/sections/Testimonials.tsx`, make it `"use client"`, import `useParallax`, and attach a `useParallax<HTMLDivElement>(24)` ref to a decorative background layer (add a subtle absolutely-positioned glow div if none exists). Do not parallax the quote text itself.

- [ ] **Step 3: Verify & commit**

```bash
cd ~/Desktop/projects/pagistry-site
npx tsc --noEmit && npm run build
git add -A && git commit -m "feat(motion): magnetic CTAs + testimonials parallax"
```

---

## Task 5 (Phase 5): New content sections + bento Features + recompose

**Files:** Modify `src/lib/content.ts`, `src/components/sections/Features.tsx`, `src/app/page.tsx`; Create `TemplateGallery.tsx`, `UseCases.tsx`, `Comparison.tsx`, `FAQ.tsx`. **Invoke the frontend-design skill for the visual polish of these sections.**

- [ ] **Step 1: Extend `src/lib/content.ts`**

```ts
export const TEMPLATES = [
  "SaaS landing",
  "Portfolio",
  "Agency",
  "E-commerce",
  "Blog",
  "Event",
  "Startup",
  "Personal",
  "Docs",
  "Newsletter",
  "Restaurant",
  "Course",
] as const;

export type UseCase = { title: string; text: string; icon: string };
export const USE_CASES: UseCase[] = [
  {
    icon: "Rocket02",
    title: "Landing pages",
    text: "Spin up high-converting launch and campaign pages in an afternoon.",
  },
  {
    icon: "Image01",
    title: "Portfolios",
    text: "Showcase work with responsive galleries and case-study detail pages.",
  },
  {
    icon: "Grid01",
    title: "SaaS sites",
    text: "Marketing sites with pricing, docs and a CMS your whole team can edit.",
  },
  {
    icon: "File02",
    title: "Blogs",
    text: "Model posts as a collection; detail pages generate from your content.",
  },
];

export type CompareRow = { feature: string; pagistry: boolean; code: boolean; builders: boolean };
export const COMPARISON: CompareRow[] = [
  { feature: "No code required", pagistry: true, code: false, builders: true },
  { feature: "Pixel-level control", pagistry: true, code: true, builders: false },
  { feature: "Per-breakpoint design", pagistry: true, code: true, builders: false },
  { feature: "Built-in CMS", pagistry: true, code: false, builders: false },
  { feature: "One-click publish", pagistry: true, code: false, builders: true },
  { feature: "Own your markup", pagistry: true, code: true, builders: false },
];

export type Faq = { q: string; a: string };
export const FAQ: Faq[] = [
  {
    q: "Do I need to know how to code?",
    a: "No. Pagistry is fully visual — but you still get clean, fast output and pixel-level control.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes, custom domains are included on Pro and Team plans with automatic SSL.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — build and publish one site for free on a Pagistry subdomain, forever.",
  },
  {
    q: "Can my whole team edit?",
    a: "Team plans add roles, permissions and a shared design system so everyone stays on-brand.",
  },
  {
    q: "What about SEO?",
    a: "Pages are server-rendered with full control over meta, Open Graph, sitemaps and clean markup.",
  },
];
```

(Verify the icon names `Rocket02, Image01, Grid01, File02` exist in `@untitledui/icons` via `node -e "..."` as in the base plan; swap any missing for the nearest real export.)

- [ ] **Step 2: Rework `src/components/sections/Features.tsx` into a bento grid**

Keep the existing `FEATURES` content + `Tilt`/`Reveal`. Replace the uniform `grid sm:grid-cols-2 lg:grid-cols-3` with an asymmetric bento (CSS grid with `col-span`/`row-span` variations — e.g. a 4-col grid where the first feature spans 2 cols and includes a small animated motif). Skeleton direction (elevate with frontend-design):

```tsx
// grid: "grid grid-cols-1 gap-4 md:grid-cols-4 md:auto-rows-[200px]"
// tile sizes per index, e.g.: [0]: md:col-span-2 md:row-span-2 (feature tile with a mini live block/cursor motif),
//   [1]: md:col-span-2, [2]: md:col-span-1, [3]: md:col-span-1, [4]: md:col-span-2, [5]: md:col-span-2
```

Each tile keeps icon/title/text from `FEATURES`; the large tile gets a small decorative animated element (e.g. a couple of drifting block chips reusing framer-motion). Preserve `id="features"`.

- [ ] **Step 3: Create the four new sections** (skeletons — elevate with frontend-design)

`src/components/sections/TemplateGallery.tsx` — two opposite-direction parallax rows of template cards:

```tsx
"use client";
import { useParallax } from "@/lib/motion/useParallax";
import { TEMPLATES } from "@/lib/content";
export function TemplateGallery() {
  const rowA = useParallax<HTMLDivElement>(60);
  const rowB = useParallax<HTMLDivElement>(-60);
  const half = Math.ceil(TEMPLATES.length / 2);
  const card = (t: string, i: number) => (
    <div
      key={t + i}
      className="flex h-40 w-64 shrink-0 flex-col justify-end rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-xs"
    >
      <div className="mb-auto h-16 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50" />
      <span className="text-sm font-semibold text-gray-700">{t}</span>
    </div>
  );
  return (
    <section className="overflow-hidden py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Start from a template
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Dozens of starting points — then make them yours.
        </p>
      </div>
      <div ref={rowA} className="mt-12 flex gap-4 px-6">
        {TEMPLATES.slice(0, half).map(card)}
      </div>
      <div ref={rowB} className="mt-4 flex gap-4 px-6">
        {TEMPLATES.slice(half).map(card)}
      </div>
    </section>
  );
}
```

`src/components/sections/UseCases.tsx` — persona cards from `USE_CASES` (icons via `@untitledui/icons` dynamic, wrap in `Reveal`):

```tsx
"use client";
import * as Icons from "@untitledui/icons";
import { Reveal } from "@/components/motion/Reveal";
import { USE_CASES } from "@/lib/content";
export function UseCases() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Built for whatever you ship
        </h2>
      </div>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {USE_CASES.map((u, i) => {
          const Icon =
            (Icons as Record<string, React.ComponentType<{ className?: string }>>)[u.icon] ??
            Icons.Star01;
          return (
            <Reveal key={u.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{u.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{u.text}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
```

`src/components/sections/Comparison.tsx` — check-grid from `COMPARISON`:

```tsx
import { Check, X } from "@untitledui/icons";
import { COMPARISON } from "@/lib/content";
export function Comparison() {
  const cell = (v: boolean) =>
    v ? (
      <Check className="mx-auto size-5 text-brand-600" />
    ) : (
      <X className="mx-auto size-5 text-gray-300" />
    );
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Why Pagistry
          </h2>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-4 text-left font-medium">Feature</th>
                <th className="p-4 font-semibold text-brand-600">Pagistry</th>
                <th className="p-4 font-medium">Hand-coding</th>
                <th className="p-4 font-medium">Other builders</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.feature} className="border-b border-gray-100 last:border-0">
                  <td className="p-4 font-medium text-gray-800">{r.feature}</td>
                  <td className="p-4 text-center">{cell(r.pagistry)}</td>
                  <td className="p-4 text-center">{cell(r.code)}</td>
                  <td className="p-4 text-center">{cell(r.builders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

(Confirm `Check`/`X` exist in `@untitledui/icons`; if named differently e.g. `Check`/`XClose`, use the real names.)

`src/components/sections/FAQ.tsx` — accordion (native `<details>` is simplest + accessible; elevate styling with frontend-design):

```tsx
import { FAQ as FAQS } from "@/lib/content";
export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Frequently asked questions
        </h2>
      </div>
      <div className="mt-12 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
        {FAQS.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-gray-900">
              {f.q}
              <span className="ml-4 text-gray-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Recompose `src/app/page.tsx`**

```tsx
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { LogoCloud } from "@/components/sections/LogoCloud";
import { ProductShowcase } from "@/components/sections/ProductShowcase";
import { Features } from "@/components/sections/Features";
import { TemplateGallery } from "@/components/sections/TemplateGallery";
import { UseCases } from "@/components/sections/UseCases";
import { Stats } from "@/components/sections/Stats";
import { Testimonials } from "@/components/sections/Testimonials";
import { Comparison } from "@/components/sections/Comparison";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="bg-white">
      <Nav />
      <Hero />
      <LogoCloud />
      <ProductShowcase />
      <Features />
      <TemplateGallery />
      <UseCases />
      <Stats />
      <Testimonials />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
```

(The old `HowItWorks` section is superseded by `ProductShowcase` — remove it from the composition; the file may remain unused or be deleted if nothing imports it.)

- [ ] **Step 5: Verify & commit**

```bash
cd ~/Desktop/projects/pagistry-site
npx tsc --noEmit && npm run build
git add -A && git commit -m "feat(sections): bento Features, TemplateGallery, UseCases, Comparison, FAQ; recompose page"
```

---

## Self-Review

**Spec coverage:**

- Motion stack (GSAP+ScrollTrigger+Lenis+Three.js on framer) → Task 1 deps + Tasks 1–4 ✓
- SmoothScroll provider synced to GSAP, reduced-motion bypass → Task 1 ✓
- Motion-env gating (reduced-motion + mobile/low-power) → Task 1 `env.ts`, consumed in Tasks 2–4 ✓
- WebGL hero (drifting blocks + gradient) + static fallback + `ssr:false` lazy + 3D-tilt card → Task 2 ✓
- Pinned scroll-scrub Product Showcase + reduced-motion fallback → Task 3 ✓
- Parallax pass (Stats Task 1, Testimonials Task 4) + magnetic CTAs → Tasks 1/4 ✓
- New sections: bento Features, TemplateGallery, UseCases, Comparison, FAQ → Task 5 ✓
- Content extended (SHOWCASE_STEPS, TEMPLATES, USE_CASES, COMPARISON, FAQ) → Tasks 3/5 ✓
- Page recomposed → Task 5 ✓
- Perf/a11y: `ssr:false` lazy WebGL, reduced-motion + mobile gating, DPR cap, SSR'd hero text → Tasks 1/2 + `env.ts` ✓
- Gate `tsc` + `next build`, no tests → every task ✓
- Phasing (5 phases, each green) → Tasks 1–5 map to Phases 1–5 ✓

**Placeholder scan:** No TBD/implement-later. The "verify/adapt" steps (Lenis ref type, drei `RoundedBox`, icon names, peer-deps) are grounded checks with exact fallbacks, required because they depend on external package internals. Frontend-design delegation for Phase-5 visuals is explicit and intended, with compiling skeletons provided (not vague prose).

**Type consistency:** `useMotionEnv(): MotionEnv` (Task 1) consumed identically in Tasks 2–4. `useParallax<T>(speed)` returns a ref, used in Tasks 1/4/5. `SHOWCASE_STEPS: ShowcaseStep[]`, `USE_CASES: UseCase[]`, `COMPARISON: CompareRow[]`, `FAQ: Faq[]`, `TEMPLATES` defined in `content.ts` (Tasks 3/5) and consumed with matching shapes. `cx` from `@/utils/cx` and `@/` → `./src` used throughout. `HeroScene` is `export default` (required for `dynamic`).
