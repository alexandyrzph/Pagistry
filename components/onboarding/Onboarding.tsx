"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoodleBuild, DoodleConfetti, DoodleMagic, DoodlePublish, DoodleWave } from "./doodles";

type Step = {
  Doodle: typeof DoodleWave;
  accent: string;
  bg: string;
  eyebrow: string;
  title: string;
  body: string;
  chips: string[];
};

export function Onboarding({ name }: { name: string }) {
  const router = useRouter();
  const first = name ? `Welcome, ${name.split(" ")[0]}!` : "Welcome to Pagecraft!";

  const STEPS: Step[] = [
    { Doodle: DoodleWave, accent: "#6366f1", bg: "from-indigo-50 via-white to-violet-50", eyebrow: "Hello there", title: first, body: "Pagecraft is your visual studio for building, publishing and shipping beautiful pages — no code required. Let's take a quick tour.", chips: ["Drag & drop", "Responsive", "Publish anywhere"] },
    { Doodle: DoodleBuild, accent: "#6366f1", bg: "from-sky-50 via-white to-indigo-50", eyebrow: "Build visually", title: "Drag, drop, done", body: "Stack sections, columns and blocks right on the canvas. Tweak spacing, colors and type in the inspector — and see it live across every device.", chips: ["50+ blocks", "Design system", "Per-breakpoint styles"] },
    { Doodle: DoodleMagic, accent: "#7c3aed", bg: "from-violet-50 via-white to-fuchsia-50", eyebrow: "Move faster", title: "Generate with AI", body: "Describe what you need and let AI draft whole sections — or even full pages. Rewrite copy, shorten, expand, all without leaving the canvas.", chips: ["Section & page generation", "AI rewrite", "Your own API keys"] },
    { Doodle: DoodlePublish, accent: "#059669", bg: "from-emerald-50 via-white to-teal-50", eyebrow: "Go live", title: "Publish in one click", body: "When it's ready, hit publish. Your page goes live with a shareable link, working forms, and CMS-driven content. Export clean HTML anytime.", chips: ["One-click publish", "Forms & CMS", "HTML export"] },
    { Doodle: DoodleConfetti, accent: "#e11d48", bg: "from-rose-50 via-white to-amber-50", eyebrow: "All set", title: "You're ready to build", body: "That's the tour! Jump into your workspace and create your first page. You can revisit any of this from the docs at any time.", chips: [] },
  ];

  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [finishing, setFinishing] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); };

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: d * 60 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -60 }),
  };

  async function finish() {
    setFinishing(true);
    try {
      await fetch("/api/auth/onboard", { method: "POST" });
    } catch { /* ignore */ }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className={cn("relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br transition-colors duration-700", step.bg)}>
      {/* ambient blobs */}
      <motion.div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: step.accent, opacity: 0.12 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: step.accent, opacity: 0.1 }} animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 10, repeat: Infinity }} />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-800">
          <Sparkles size={16} className="text-indigo-500" /> Pagecraft
        </div>
        {!last && (
          <button onClick={finish} className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600">Skip tour</button>
        )}
      </div>

      {/* content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-lg flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.05 }}
              className="mb-8 flex h-52 w-52 items-center justify-center rounded-[2.5rem] bg-white/70 shadow-xl shadow-black/5 ring-1 ring-black/5 backdrop-blur"
            >
              <step.Doodle accent={step.accent} className="h-40 w-40" />
            </motion.div>
            <span className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: step.accent }}>{step.eyebrow}</span>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{step.title}</h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-500">{step.body}</p>
            {step.chips.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {step.chips.map((chip, ci) => (
                  <motion.span
                    key={chip}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + ci * 0.08 }}
                    className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-black/5"
                  >
                    {chip}
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* controls */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 pb-10">
        <div className="flex items-center gap-2">
          {STEPS.map((_, idx) => (
            <button key={idx} onClick={() => go(idx)} aria-label={`Step ${idx + 1}`}
              className={cn("h-2 rounded-full transition-all", idx === i ? "w-7 bg-zinc-800" : "w-2 bg-zinc-300 hover:bg-zinc-400")} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {i > 0 && (
            <button onClick={() => go(i - 1)} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-800">
              <ArrowLeft size={15} /> Back
            </button>
          )}
          {last ? (
            <button onClick={finish} disabled={finishing}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-800 disabled:opacity-60">
              {finishing ? <Loader2 size={16} className="animate-spin" /> : <>Start building <ArrowRight size={15} /></>}
            </button>
          ) : (
            <button onClick={() => go(i + 1)}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-800">
              Next <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
