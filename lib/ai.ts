import { REGISTRY, createBlock } from "./registry";
import type { Block, ResponsiveStyles, SettingField, StyleProps } from "./types";

// ---------------------------------------------------------------------------
// AI section generation — provider-agnostic helpers. The model is asked to emit
// a JSON array of blocks; we then sanitize it against the real block registry
// so only valid types/props ever reach the canvas.
// ---------------------------------------------------------------------------

function describeField(f: SettingField): string {
  if (f.type === "items" && f.itemFields) {
    const sub = f.itemFields.map((s) => s.key).join(", ");
    return `${f.key} (array of objects with: ${sub})`;
  }
  if (f.type === "stringlist") return `${f.key} (array of strings)`;
  return `${f.key} (${f.type})`;
}

/** Compact description of every block type + props for the model prompt. */
export function blockSchema(): string {
  const skip = new Set(["column", "component"]);
  const lines: string[] = [];
  for (const [type, def] of Object.entries(REGISTRY)) {
    if (skip.has(type)) continue;
    const props = def.fields.length ? def.fields.map(describeField).join("; ") : "(no props)";
    const container = def.isContainer ? " — CONTAINER, may hold children blocks" : "";
    lines.push(`- "${type}" (${def.label})${container}. props: ${props}`);
  }
  return lines.join("\n");
}

// --- Design directions (art-direction presets exposed in the AI modal) ------

export const DESIGN_STYLE_OPTIONS: { key: string; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "bold-dark", label: "Bold · Dark" },
  { key: "soft-pastel", label: "Soft · Pastel" },
  { key: "editorial", label: "Editorial" },
  { key: "glass", label: "Glass" },
  { key: "brutalist", label: "Brutalist" },
  { key: "mono", label: "Mono" },
];

export const DESIGN_STYLE_KEYS = DESIGN_STYLE_OPTIONS.map((o) => o.key);

const DESIGN_DIRECTIONS: Record<string, string> = {
  auto: "Pick a distinctive aesthetic that genuinely fits this brand/topic. Commit to a specific mood — do NOT fall back on a generic indigo SaaS look.",
  "bold-dark":
    "Bold & dark. Deep near-black or rich dark backgrounds, one vivid accent color, high contrast, large heavy headings, glowing gradient accents on the hero/CTA.",
  "soft-pastel":
    "Soft & pastel. Light airy backgrounds with gentle pastel tints, soft diffuse shadows, large border-radius, friendly medium-weight type, lots of whitespace.",
  editorial:
    "Editorial / magazine. A serif or high-contrast display feel via fontFamily 'Georgia, serif' on headings, generous line-height, a restrained cream/ink palette, strong typographic hierarchy.",
  glass:
    "Glassmorphic. Layered vibrant gradient backgrounds, translucent frosted panels (rgba() backgrounds with subtle light borders), soft glows, rounded corners.",
  brutalist:
    "Neo-brutalist. Stark high-contrast colors, thick visible borders (borderWidth 2-3px, borderColor #000), hard offset shadows (boxShadow '6px 6px 0 #000'), borderRadius 0, bold UPPERCASE headings.",
  mono: "Refined monochrome. One hue in several shades plus neutrals, minimal, lots of whitespace, crisp type, subtle 1px borders, a single restrained accent.",
};

// Shared "how to art-direct" brief injected into every generation prompt.
const STYLE_BRIEF = `You may also set a "styles" object on ANY block to art-direct it:
"styles": { "desktop": { <cssProp>: "<value>" }, "tablet": { ... }, "mobile": { ... } }
Use camelCase CSS keys ONLY from this set:
backgroundColor, backgroundImage (supports linear-gradient(...)/radial-gradient(...)), color,
paddingTop, paddingRight, paddingBottom, paddingLeft, marginTop, marginBottom,
fontSize, fontWeight, lineHeight, letterSpacing, textAlign, textTransform, fontFamily,
borderRadius, borderWidth, borderColor, borderStyle, boxShadow, opacity, maxWidth, minHeight, gap.
Values are plain CSS strings with NO semicolons or braces, e.g. "linear-gradient(135deg, #0b1020, #3b2f7a)", "120px", "#ffffff", "0 20px 60px rgba(0,0,0,.25)".

Design like a senior web designer — make it look intentional and unique, NOT a default template:
- Commit to ONE cohesive palette for the whole output (2 brand colors + neutrals) and reuse it on every section.
- Create rhythm: alternate section backgrounds (e.g. dark hero → light section → tinted section → dark CTA). Never leave every section plain white.
- Put real backgrounds on section blocks (hero, features, stats, testimonial, pricing, cta) via styles.desktop.backgroundColor or a backgroundImage gradient — and ALWAYS pair it with a matching "color" so text stays readable.
- Use generous vertical padding on sections (paddingTop/paddingBottom 80–128px).
- Establish a clear type hierarchy; keep strong contrast everywhere.

Example of a well-styled block:
{ "type":"hero", "props":{"eyebrow":"NEW","title":"Ship faster","subtitle":"...","buttonText":"Start free","buttonHref":"#","align":"center"},
  "styles":{ "desktop":{ "backgroundImage":"linear-gradient(135deg, #0b1020, #3b2f7a)", "color":"#ffffff", "paddingTop":"120px", "paddingBottom":"120px" } } }`;

const JSON_RULES = `Output ONLY a JSON array of blocks — no prose, no markdown code fences. It must parse as valid JSON.
Each block is: { "type": "<type>", "props": { ... }, "styles": { ... } (optional), "children": [ ... ] (only for CONTAINER blocks) }.`;

function direction(styleKey: string): string {
  return DESIGN_DIRECTIONS[styleKey] ?? DESIGN_DIRECTIONS.auto;
}

/** System prompt for generating one or a few sections, art-directed by style. */
export function sectionSystemPrompt(styleKey = "auto"): string {
  return `You generate website sections for a block-based page builder.
${JSON_RULES}

Available block types and their props:
${blockSchema()}

${STYLE_BRIEF}

DESIGN DIRECTION: ${direction(styleKey)}

Rules:
- Use ONLY the listed block types and prop keys.
- Write specific, compelling marketing copy — never lorem ipsum.
- Prefer rich section blocks (hero, features, pricing, cta, testimonial, stats) over raw layout.
- Return 1–3 top-level blocks, each fully styled per the design direction.`;
}

/** System prompt for generating a complete, cohesive landing page. */
export function pageSystemPrompt(styleKey = "auto"): string {
  return `You generate a COMPLETE landing page for a block-based page builder.
${JSON_RULES}

Available block types and their props:
${blockSchema()}

${STYLE_BRIEF}

DESIGN DIRECTION: ${direction(styleKey)}

Rules:
- Build a full, cohesive page: a "navbar", a "hero", 2–4 content sections (features, stats, testimonial, pricing, cta) and a "footer".
- 5–9 top-level blocks. Use ONLY the listed types and prop keys.
- Apply ONE shared palette across navbar, hero, every section and footer; alternate section backgrounds for rhythm.
- Write specific, on-brand marketing copy tailored to the request — never lorem ipsum. Keep the brand name/voice consistent across navbar, hero and footer.`;
}

// Back-compat aliases (auto direction).
export const SYSTEM_PROMPT = sectionSystemPrompt("auto");
export const PAGE_SYSTEM_PROMPT = pageSystemPrompt("auto");

// --- Rewrite / improve text -------------------------------------------------

export const REWRITE_SYSTEM =
  "You are a precise copy editor for website content. Rewrite the user's text per the instruction. Return ONLY the rewritten text — no quotes, no preamble, no markdown, no explanation. Keep it roughly the same length unless the instruction says otherwise.";

export const REWRITE_INSTRUCTIONS: Record<string, string> = {
  improve: "Improve the writing: make it clearer, more compelling and polished",
  shorten: "Make it more concise while keeping the meaning",
  expand: "Expand it with a little more useful detail",
  grammar: "Fix any spelling and grammar mistakes, keep the wording otherwise",
  professional: "Rewrite it in a more professional, confident tone",
  casual: "Rewrite it in a more casual, friendly tone",
};

/** Pull the first JSON array out of a model response (handles code fences/prose). */
export function extractJsonArray(text: string): unknown {
  if (!text) return null;
  let t = text.trim();
  // strip ```json ... ``` fences if present
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

// --- Style sanitization (AI-emitted styles → safe StyleProps) ---------------

// Allowed style keys — must mirror StyleProps in lib/types.ts.
const STYLE_KEYS = new Set<string>([
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginRight", "marginBottom", "marginLeft",
  "color", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "textTransform", "fontFamily",
  "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
  "borderRadius", "borderWidth", "borderColor", "borderStyle",
  "boxShadow", "opacity",
  "width", "maxWidth", "minHeight", "display", "gap", "alignItems", "justifyContent",
]);

/** A style value is injected into a stylesheet, so reject CSS-injection vectors. */
function safeStyleValue(raw: unknown): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v || v.length > 240) return null;
  if (/[{}<>;]/.test(v)) return null; // no rule break-out / markup
  if (/javascript:|expression\s*\(|@import|url\(\s*['"]?\s*(?:javascript:|data:text\/html)/i.test(v)) return null;
  return v;
}

function sanitizeStyleProps(input: unknown): StyleProps {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out as StyleProps;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!STYLE_KEYS.has(k)) continue;
    const val = safeStyleValue(v);
    if (val != null) out[k] = val;
  }
  return out as StyleProps;
}

function sanitizeResponsiveStyles(input: unknown): ResponsiveStyles {
  const out: ResponsiveStyles = {};
  if (!input || typeof input !== "object") return out;
  for (const vp of ["desktop", "tablet", "mobile"] as const) {
    const sp = sanitizeStyleProps((input as Record<string, unknown>)[vp]);
    if (Object.keys(sp).length) out[vp] = sp;
  }
  return out;
}

/** Merge AI styles over the block's defaults (AI wins per property/viewport). */
function mergeStyles(base: ResponsiveStyles, over: ResponsiveStyles): ResponsiveStyles {
  const merged: ResponsiveStyles = {};
  for (const vp of ["desktop", "tablet", "mobile"] as const) {
    const b = base[vp];
    const o = over[vp];
    if (b || o) merged[vp] = { ...(b ?? {}), ...(o ?? {}) };
  }
  return merged;
}

/** Validate model output against the registry → safe Block[] with fresh ids. */
export function sanitizeGeneratedBlocks(input: unknown, depth = 0): Block[] {
  if (!Array.isArray(input) || depth > 5) return [];
  const out: Block[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const type = (raw as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    const def = REGISTRY[type];
    if (!def || type === "column" || type === "component") continue;

    const block = createBlock(type); // fresh id + defaults + default children
    const props = (raw as { props?: unknown }).props;
    if (props && typeof props === "object") {
      for (const f of def.fields) {
        const v = (props as Record<string, unknown>)[f.key];
        if (v !== undefined && v !== null) block.props[f.key] = v;
      }
    }
    // Art-direction: merge any AI-emitted styles over the block's defaults.
    const aiStyles = sanitizeResponsiveStyles((raw as { styles?: unknown }).styles);
    block.styles = mergeStyles(block.styles, aiStyles);

    if (def.isContainer) {
      const children = (raw as { children?: unknown }).children;
      if (Array.isArray(children)) block.children = sanitizeGeneratedBlocks(children, depth + 1);
    }
    out.push(block);
  }
  return out;
}

/** Canned output used by the "mock" provider (for local testing without a key). */
export const MOCK_BLOCKS = [
  {
    type: "hero",
    props: {
      eyebrow: "New",
      title: "Generated with AI",
      subtitle: "This section was produced by the mock AI provider to verify the pipeline.",
      buttonText: "Get started",
      buttonHref: "#",
      align: "center",
    },
    styles: {
      desktop: {
        backgroundImage: "linear-gradient(135deg, #0b1020, #3b2f7a)",
        color: "#ffffff",
        paddingTop: "120px",
        paddingBottom: "120px",
      },
    },
  },
  {
    type: "features",
    props: {
      title: "Why it works",
      subtitle: "A few reasons teams love it.",
      columns: 3,
      items: [
        { icon: "Zap", title: "Fast", text: "Generates sections in seconds." },
        { icon: "Shield", title: "Safe", text: "Output is validated against the schema." },
        { icon: "Sparkles", title: "Flexible", text: "Use OpenAI or Anthropic." },
      ],
    },
    styles: { desktop: { backgroundColor: "#f5f3ff", paddingTop: "96px", paddingBottom: "96px" } },
  },
];

/** Canned full page for the "mock" provider. */
export const MOCK_PAGE = [
  { type: "navbar", props: { brand: "Acme", links: ["Home", "Features", "Pricing"], ctaText: "Get started", ctaHref: "#" } },
  ...MOCK_BLOCKS,
  {
    type: "cta",
    props: { title: "Ready to dive in?", subtitle: "Start building today.", buttonText: "Get started", buttonHref: "#" },
    styles: { desktop: { backgroundImage: "linear-gradient(135deg, #3b2f7a, #0b1020)", color: "#ffffff", paddingTop: "112px", paddingBottom: "112px" } },
  },
  { type: "footer", props: { brand: "Acme", tagline: "Built with AI.", links: ["Home", "About"], copyright: "© 2026 Acme" } },
];
