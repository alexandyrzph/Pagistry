"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/registry-types";
import { DynamicIcon, Editable } from "./shared";

export { sectionBlocks } from "./sections.defs";

// --- Hero -------------------------------------------------------------------

export function HeroBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    eyebrow = "Welcome",
    title = "Build something beautiful",
    subtitle = "A clean, modern hero section to introduce your product or idea.",
    buttonText = "Get started",
    buttonHref = "#",
    align = "center",
  } = block.props;
  const alignCls =
    align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
  return (
    <section id={id} className={cn("relative w-full overflow-hidden", className)} style={style}>
      <div className={cn("mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24", alignCls)}>
        <Editable as="span" value={eyebrow} editable={editable} onCommit={(v) => setProp("eyebrow", v)}
          className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide backdrop-blur" />
        <Editable as="h1" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
          className="text-4xl font-extrabold leading-tight sm:text-6xl" />
        <Editable as="p" multiline value={subtitle} editable={editable} onCommit={(v) => setProp("subtitle", v)}
          className="max-w-2xl text-lg opacity-90" />
        <div className="mt-2">
          <a href={editable ? undefined : buttonHref} onClick={editable ? (e) => e.preventDefault() : undefined}
            className="inline-block cursor-pointer rounded-xl bg-white px-7 py-3.5 font-semibold text-slate-900 no-underline shadow-lg transition-transform hover:-translate-y-0.5">
            <Editable as="span" value={buttonText} editable={editable} onCommit={(v) => setProp("buttonText", v)} />
          </a>
        </div>
      </div>
    </section>
  );
}

// --- Feature grid -----------------------------------------------------------

type Feature = { icon: string; title: string; text: string };

export function FeatureGridBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    title = "Everything you need",
    subtitle = "Powerful features that help you move faster.",
    items = [] as Feature[],
    columns = 3,
  } = block.props;
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Editable as="h2" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
            className="text-3xl font-bold text-slate-900 sm:text-4xl" />
          <Editable as="p" multiline value={subtitle} editable={editable} onCommit={(v) => setProp("subtitle", v)}
            className="mt-4 text-lg text-slate-500" />
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {(items as Feature[]).map((f, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <DynamicIcon name={f.icon} size={24} style={{ color: "var(--pc-brand, #6366f1)" }} />
              </div>
              <Editable as="h3" value={f.title} editable={editable} onCommit={(v) => setProp(`items.${i}.title`, v)}
                className="text-lg font-semibold text-slate-900" />
              <Editable as="p" multiline value={f.text} editable={editable} onCommit={(v) => setProp(`items.${i}.text`, v)}
                className="mt-2 text-slate-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Pricing ----------------------------------------------------------------

type Plan = { name: string; price: string; period: string; features: string; buttonText: string; featured?: boolean };

export function PricingBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const { title = "Simple pricing", subtitle = "Choose the plan that fits.", items = [] as Plan[] } = block.props;
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Editable as="h2" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
            className="text-3xl font-bold text-slate-900 sm:text-4xl" />
          <Editable as="p" value={subtitle} editable={editable} onCommit={(v) => setProp("subtitle", v)}
            className="mt-4 text-lg text-slate-500" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {(items as Plan[]).map((p, i) => (
            <div key={i} className={cn(
              "flex flex-col rounded-2xl border p-8 shadow-sm",
              p.featured ? "border-indigo-500 bg-slate-900 text-white shadow-xl" : "border-slate-200 bg-white"
            )}>
              <Editable as="h3" value={p.name} editable={editable} onCommit={(v) => setProp(`items.${i}.name`, v)}
                className="text-lg font-semibold" />
              <div className="mt-4 flex items-baseline gap-1">
                <Editable as="span" value={p.price} editable={editable} onCommit={(v) => setProp(`items.${i}.price`, v)}
                  className="text-4xl font-extrabold" />
                <span className={p.featured ? "text-slate-400" : "text-slate-400"}>{p.period}</span>
              </div>
              <ul className={cn("mt-6 flex flex-1 flex-col gap-3 text-sm", p.featured ? "text-slate-200" : "text-slate-600")}>
                {(p.features ?? "").split("\n").filter(Boolean).map((line, j) => (
                  <li key={j} className="flex items-center gap-2">
                    <DynamicIcon name="Check" size={16} style={{ color: "var(--pc-brand, #6366f1)" }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <a href="#" onClick={editable ? (e) => e.preventDefault() : undefined}
                style={p.featured ? undefined : { backgroundColor: "var(--pc-brand, #6366f1)" }}
                className={cn(
                "mt-8 cursor-pointer rounded-xl px-5 py-3 text-center font-semibold no-underline transition-transform hover:-translate-y-0.5",
                p.featured ? "bg-white text-slate-900" : "text-white"
              )}>
                <Editable as="span" value={p.buttonText} editable={editable} onCommit={(v) => setProp(`items.${i}.buttonText`, v)} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Testimonial ------------------------------------------------------------

export function TestimonialBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    quote = "This product completely changed how our team works. Couldn't recommend it more.",
    author = "Jamie Rivera",
    role = "Head of Product, Acme",
    avatar = "https://i.pravatar.cc/120?img=12",
    rating = 5,
  } = block.props;
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mb-6 flex justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <DynamicIcon key={i} name="Star" size={22}
              style={{ color: i < Number(rating) ? "#f59e0b" : "#e2e8f0", fill: i < Number(rating) ? "#f59e0b" : "transparent" }} />
          ))}
        </div>
        <Editable as="p" multiline value={quote} editable={editable} onCommit={(v) => setProp("quote", v)}
          className="text-2xl font-medium leading-relaxed text-slate-800" />
        <div className="mt-8 flex items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt={author} className="h-12 w-12 rounded-full object-cover" />
          <div className="text-left">
            <Editable as="div" value={author} editable={editable} onCommit={(v) => setProp("author", v)}
              className="font-semibold text-slate-900" />
            <Editable as="div" value={role} editable={editable} onCommit={(v) => setProp("role", v)}
              className="text-sm text-slate-500" />
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Stats ------------------------------------------------------------------

type Stat = { value: string; label: string };

export function StatsBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const { items = [] as Stat[] } = block.props;
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16"
        style={{ gridTemplateColumns: `repeat(${Math.min((items as Stat[]).length || 1, 4)}, minmax(0, 1fr))` }}>
        {(items as Stat[]).map((s, i) => (
          <div key={i} className="text-center">
            <Editable as="div" value={s.value} editable={editable} onCommit={(v) => setProp(`items.${i}.value`, v)}
              style={{ color: "var(--pc-brand, #6366f1)" }}
              className="text-4xl font-extrabold sm:text-5xl" />
            <Editable as="div" value={s.label} editable={editable} onCommit={(v) => setProp(`items.${i}.label`, v)}
              className="mt-2 text-sm font-medium uppercase tracking-wide text-slate-500" />
          </div>
        ))}
      </div>
    </section>
  );
}

// --- CTA --------------------------------------------------------------------

export function CtaBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    title = "Ready to get started?",
    subtitle = "Join thousands of teams building with us today.",
    buttonText = "Start free",
    buttonHref = "#",
  } = block.props;
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <Editable as="h2" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
          className="text-3xl font-bold sm:text-4xl" />
        <Editable as="p" value={subtitle} editable={editable} onCommit={(v) => setProp("subtitle", v)}
          className="mx-auto mt-4 max-w-xl text-lg opacity-90" />
        <a href={editable ? undefined : buttonHref} onClick={editable ? (e) => e.preventDefault() : undefined}
          className="mt-8 inline-block cursor-pointer rounded-xl bg-white px-8 py-3.5 font-semibold text-slate-900 no-underline shadow-lg transition-transform hover:-translate-y-0.5">
          <Editable as="span" value={buttonText} editable={editable} onCommit={(v) => setProp("buttonText", v)} />
        </a>
      </div>
    </section>
  );
}

// --- Footer -----------------------------------------------------------------

export function FooterBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    brand = "YourBrand",
    tagline = "Building the web, one block at a time.",
    links = ["Home", "Features", "Pricing", "About", "Contact"] as string[],
    copyright = "© 2026 YourBrand. All rights reserved.",
  } = block.props;
  return (
    <footer id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-14">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Editable as="div" value={brand} editable={editable} onCommit={(v) => setProp("brand", v)}
              className="text-xl font-bold" />
            <Editable as="div" value={tagline} editable={editable} onCommit={(v) => setProp("tagline", v)}
              className="mt-1 text-sm opacity-70" />
          </div>
          <nav className="flex flex-wrap gap-6 text-sm">
            {(links as string[]).map((l, i) => (
              <Editable key={i} as="a" value={l} editable={editable} onCommit={(v) => setProp(`links.${i}`, v)}
                className="cursor-pointer opacity-80 no-underline hover:opacity-100" />
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 pt-6">
          <Editable as="div" value={copyright} editable={editable} onCommit={(v) => setProp("copyright", v)}
            className="text-sm opacity-60" />
        </div>
      </div>
    </footer>
  );
}

