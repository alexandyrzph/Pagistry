import { createBlock } from "./registry";
import type { Block, ResponsiveStyles } from "./types";

// Helper: build a block with overridden props / styles / children.
function b(
  type: string,
  props: Record<string, any> = {},
  styles?: ResponsiveStyles,
  children?: Block[]
): Block {
  const block = createBlock(type);
  block.props = { ...block.props, ...props };
  if (styles) block.styles = styles;
  if (children) block.children = children;
  return block;
}

export type Template = {
  id: string;
  name: string;
  description: string;
  build: () => Block[];
};

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from an empty canvas.",
    build: () => [],
  },
  {
    id: "landing",
    name: "Landing page",
    description: "Hero, features, stats and a call to action.",
    build: () => [
      b("hero", {
        eyebrow: "New · v2.0",
        title: "Ship beautiful pages in minutes",
        subtitle: "A drag-and-drop builder with polished blocks, responsive controls and instant publishing.",
        buttonText: "Start building",
      }),
      b("features", {
        title: "Why teams choose us",
        subtitle: "Everything you need to launch faster.",
        columns: 3,
        items: [
          { icon: "Zap", title: "Lightning fast", text: "Optimised pages that load instantly on any device." },
          { icon: "Layers", title: "Reusable blocks", text: "Dozens of polished components ready to drop in." },
          { icon: "Sparkles", title: "Pixel perfect", text: "Fine-tune spacing, color and type per breakpoint." },
        ],
      }),
      b("stats", {
        items: [
          { value: "12k+", label: "Pages built" },
          { value: "99.9%", label: "Uptime" },
          { value: "4.9/5", label: "Customer rating" },
          { value: "40+", label: "Block types" },
        ],
      }, { desktop: { backgroundColor: "#f8fafc", paddingTop: "16px", paddingBottom: "16px" } }),
      b("cta", {
        title: "Ready to build your next page?",
        subtitle: "No code required. Publish in one click.",
        buttonText: "Get started free",
      }),
      b("footer", {}),
    ],
  },
  {
    id: "saas",
    name: "SaaS / Pricing",
    description: "Hero, features, pricing table and testimonial.",
    build: () => [
      b("hero", {
        eyebrow: "Pricing",
        title: "Plans that scale with you",
        subtitle: "Start free, upgrade when you're ready. Cancel anytime.",
        buttonText: "Try it free",
      }, { desktop: { backgroundImage: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#ffffff" } }),
      b("features", {
        title: "Built for modern teams",
        subtitle: "Powerful features in every plan.",
        columns: 3,
      }),
      b("pricing", {}),
      b("testimonial", {}),
      b("cta", {}),
      b("footer", {}),
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Intro hero, two-column showcase and stats.",
    build: () => [
      b("hero", {
        eyebrow: "Hello 👋",
        title: "I design & build delightful products",
        subtitle: "Product designer and front-end engineer crafting clean, human interfaces.",
        buttonText: "View my work",
        align: "left",
      }, { desktop: { backgroundColor: "#0f172a", color: "#ffffff" } }),
      b(
        "section",
        {},
        { desktop: { paddingTop: "64px", paddingBottom: "64px", paddingLeft: "24px", paddingRight: "24px", backgroundColor: "#ffffff" } },
        [
          b("columns", { layout: "1-1" }, { desktop: {} }, [
            b("column", {}, { desktop: {} }, [
              b("image", { src: "https://picsum.photos/seed/folio/800/600" }),
            ]),
            b("column", {}, { desktop: { justifyContent: "center" } }, [
              b("heading", { text: "Selected work", level: "h2" }),
              b("text", { text: "A blend of strategy, design and engineering — shipping products that feel effortless to use." }),
              b("button", { text: "See case studies" }),
            ]),
          ]),
        ]
      ),
      b("stats", {
        items: [
          { value: "8+", label: "Years experience" },
          { value: "60+", label: "Projects shipped" },
          { value: "12", label: "Awards" },
        ],
      }, { desktop: { backgroundColor: "#f8fafc" } }),
      b("footer", {}),
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
