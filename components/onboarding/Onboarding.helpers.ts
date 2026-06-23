import { DoodleBuild, DoodleConfetti, DoodleMagic, DoodlePublish, DoodleWave } from "./doodles";

export type Step = {
  Doodle: typeof DoodleWave;
  accent: string;
  bg: string;
  eyebrow: string;
  title: string;
  body: string;
  chips: string[];
};

export const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 60 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -60 }),
};

export function buildSteps(name: string): Step[] {
  const first = name ? `Welcome, ${name.split(" ")[0]}!` : "Welcome to Pagistry!";

  return [
    {
      Doodle: DoodleWave,
      accent: "#6366f1",
      bg: "from-indigo-50 via-white to-violet-50",
      eyebrow: "Hello there",
      title: first,
      body: "Pagistry is your visual studio for building, publishing and shipping beautiful pages — no code required. Let's take a quick tour.",
      chips: ["Drag & drop", "Responsive", "Publish anywhere"],
    },
    {
      Doodle: DoodleBuild,
      accent: "#6366f1",
      bg: "from-sky-50 via-white to-indigo-50",
      eyebrow: "Build visually",
      title: "Drag, drop, done",
      body: "Stack sections, columns and blocks right on the canvas. Tweak spacing, colors and type in the inspector — and see it live across every device.",
      chips: ["50+ blocks", "Design system", "Per-breakpoint styles"],
    },
    {
      Doodle: DoodleMagic,
      accent: "#7c3aed",
      bg: "from-violet-50 via-white to-fuchsia-50",
      eyebrow: "Move faster",
      title: "Generate with AI",
      body: "Describe what you need and let AI draft whole sections — or even full pages. Rewrite copy, shorten, expand, all without leaving the canvas.",
      chips: ["Section & page generation", "AI rewrite", "Your own API keys"],
    },
    {
      Doodle: DoodlePublish,
      accent: "#059669",
      bg: "from-emerald-50 via-white to-teal-50",
      eyebrow: "Go live",
      title: "Publish in one click",
      body: "When it's ready, hit publish. Your page goes live with a shareable link, working forms, and CMS-driven content. Export clean HTML anytime.",
      chips: ["One-click publish", "Forms & CMS", "HTML export"],
    },
    {
      Doodle: DoodleConfetti,
      accent: "#e11d48",
      bg: "from-rose-50 via-white to-amber-50",
      eyebrow: "All set",
      title: "You're ready to build",
      body: "That's the tour! Jump into your workspace and create your first page. You can revisit any of this from the docs at any time.",
      chips: [],
    },
  ];
}
