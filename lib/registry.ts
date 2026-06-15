import {
  BarChart3,
  Braces,
  CodeXml,
  Columns3,
  CreditCard,
  Database,
  FileText,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Mail,
  Minus,
  MousePointerClick,
  MoveVertical,
  Navigation,
  PanelBottom,
  PanelTop,
  Quote as QuoteIcon,
  Rocket,
  Square,
  Layout as SectionIcon,
  MessageSquareQuote,
  Star,
  Type,
  Video as VideoIcon,
} from "lucide-react";

import type { Block, BlockCategory } from "./types";
import type { BlockDefinition } from "./registry-types";
import { uid } from "./utils";

import {
  ColumnBlock,
  ColumnsBlock,
  DividerBlock,
  SectionBlock,
  SpacerBlock,
} from "@/components/blocks/layout";
import {
  ButtonBlock,
  HeadingBlock,
  IconBlock,
  ImageBlock,
  ListBlock,
  QuoteBlock,
  TextBlock,
  VideoBlock,
} from "@/components/blocks/basic";
import {
  CtaBlock,
  FeatureGridBlock,
  FooterBlock,
  HeroBlock,
  PricingBlock,
  StatsBlock,
  TestimonialBlock,
} from "@/components/blocks/sections";
import { FormBlock } from "@/components/blocks/form";
import { NavbarBlock } from "@/components/blocks/navbar";
import { FileBlock } from "@/components/blocks/file";
import { CodeBlock, EmbedBlock } from "@/components/blocks/embed";
import { CollectionListBlock } from "@/components/blocks/collection";
import { CollectionInspector } from "@/components/editor/CollectionInspector";

const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

export const REGISTRY: Record<string, BlockDefinition> = {
  // --- Layout ---------------------------------------------------------------
  section: {
    type: "section",
    label: "Section",
    icon: SectionIcon,
    category: "Layout",
    description: "Full-width band that holds other blocks",
    isContainer: true,
    defaultProps: {},
    defaultStyles: {
      desktop: {
        paddingTop: "64px",
        paddingBottom: "64px",
        paddingLeft: "24px",
        paddingRight: "24px",
        backgroundColor: "#ffffff",
      },
    },
    fields: [],
    styleGroups: ["background", "spacing", "border", "layout"],
    Render: SectionBlock,
  },
  columns: {
    type: "columns",
    label: "Columns",
    icon: Columns3,
    category: "Layout",
    description: "A responsive row of columns",
    isContainer: true,
    defaultProps: { layout: "1-1" },
    defaultStyles: { desktop: {} },
    fields: [
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { label: "1 column", value: "1" },
          { label: "2 columns", value: "1-1" },
          { label: "3 columns", value: "1-1-1" },
          { label: "4 columns", value: "1-1-1-1" },
          { label: "Sidebar left (1:2)", value: "1-2" },
          { label: "Sidebar right (2:1)", value: "2-1" },
        ],
      },
    ],
    styleGroups: ["spacing", "layout"],
    Render: ColumnsBlock,
    createChildren: () => [createBlock("column"), createBlock("column")],
  },
  column: {
    type: "column",
    label: "Column",
    icon: Square,
    category: "Layout",
    description: "A single column cell",
    isContainer: true,
    defaultProps: {},
    defaultStyles: { desktop: {} },
    fields: [],
    styleGroups: ["background", "spacing", "border", "layout"],
    Render: ColumnBlock,
  },
  spacer: {
    type: "spacer",
    label: "Spacer",
    icon: MoveVertical,
    category: "Layout",
    description: "Vertical empty space",
    defaultProps: { height: 48 },
    defaultStyles: { desktop: {} },
    fields: [{ key: "height", label: "Height (px)", type: "number" }],
    styleGroups: [],
    Render: SpacerBlock,
  },
  divider: {
    type: "divider",
    label: "Divider",
    icon: Minus,
    category: "Layout",
    description: "A horizontal line",
    defaultProps: { color: "#e2e8f0", thickness: 1, width: "100%", lineStyle: "solid" },
    defaultStyles: { desktop: { paddingTop: "8px", paddingBottom: "8px" } },
    fields: [
      { key: "color", label: "Color", type: "color" },
      { key: "thickness", label: "Thickness (px)", type: "number" },
      { key: "width", label: "Width", type: "text", placeholder: "100% or 200px" },
      {
        key: "lineStyle",
        label: "Style",
        type: "select",
        options: [
          { label: "Solid", value: "solid" },
          { label: "Dashed", value: "dashed" },
          { label: "Dotted", value: "dotted" },
        ],
      },
    ],
    styleGroups: ["spacing"],
    Render: DividerBlock,
  },

  // --- Basic ----------------------------------------------------------------
  heading: {
    type: "heading",
    label: "Heading",
    icon: Heading,
    category: "Basic",
    defaultProps: { text: "Your heading here", level: "h2" },
    defaultStyles: {
      desktop: {
        fontSize: "36px",
        fontWeight: "700",
        color: "#0f172a",
        lineHeight: "1.2",
        marginBottom: "8px",
      },
    },
    fields: [
      { key: "text", label: "Text", type: "text" },
      {
        key: "level",
        label: "Tag",
        type: "select",
        options: ["h1", "h2", "h3", "h4", "h5", "h6"].map((v) => ({ label: v.toUpperCase(), value: v })),
      },
    ],
    styleGroups: ["typography", "spacing"],
    Render: HeadingBlock,
  },
  text: {
    type: "text",
    label: "Text",
    icon: Type,
    category: "Basic",
    defaultProps: {
      text: "Add your paragraph text here. Click to edit — select text for bold, links and lists.",
    },
    defaultStyles: { desktop: { fontSize: "16px", color: "#475569", lineHeight: "1.7" } },
    // edited inline with the rich-text toolbar (no inspector field)
    fields: [],
    styleGroups: ["typography", "spacing"],
    Render: TextBlock,
  },
  button: {
    type: "button",
    label: "Button",
    icon: MousePointerClick,
    category: "Basic",
    defaultProps: { text: "Click me", href: "#", align: "left" },
    defaultStyles: {
      desktop: {
        backgroundColor: "var(--pc-brand, #6366f1)",
        color: "#ffffff",
        paddingTop: "12px",
        paddingBottom: "12px",
        paddingLeft: "24px",
        paddingRight: "24px",
        borderRadius: "var(--pc-radius, 10px)",
        fontWeight: "600",
        fontSize: "16px",
      },
    },
    fields: [
      { key: "text", label: "Label", type: "text" },
      { key: "href", label: "Link URL", type: "url" },
      { key: "align", label: "Align", type: "select", options: ALIGN_OPTIONS },
    ],
    styleGroups: ["typography", "background", "spacing", "border", "effects"],
    Render: ButtonBlock,
  },
  image: {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    category: "Basic",
    defaultProps: {
      src: "https://picsum.photos/seed/pagebuilder/900/560",
      alt: "Placeholder image",
      objectFit: "cover",
    },
    defaultStyles: { desktop: { borderRadius: "var(--pc-radius, 12px)", width: "100%" } },
    fields: [
      { key: "src", label: "Image URL", type: "image" },
      { key: "alt", label: "Alt text", type: "text" },
      {
        key: "objectFit",
        label: "Fit",
        type: "select",
        options: [
          { label: "Cover", value: "cover" },
          { label: "Contain", value: "contain" },
          { label: "Fill", value: "fill" },
        ],
      },
    ],
    styleGroups: ["spacing", "border", "effects", "layout"],
    Render: ImageBlock,
  },
  icon: {
    type: "icon",
    label: "Icon",
    icon: Star,
    category: "Basic",
    defaultProps: { name: "Star", size: 48, color: "var(--pc-brand, #6366f1)", align: "center" },
    defaultStyles: { desktop: {} },
    fields: [
      { key: "name", label: "Icon", type: "icon" },
      { key: "size", label: "Size (px)", type: "number" },
      { key: "color", label: "Color", type: "color" },
      { key: "align", label: "Align", type: "select", options: ALIGN_OPTIONS },
    ],
    styleGroups: ["spacing"],
    Render: IconBlock,
  },
  video: {
    type: "video",
    label: "Video",
    icon: VideoIcon,
    category: "Basic",
    defaultProps: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    defaultStyles: { desktop: { borderRadius: "12px" } },
    fields: [{ key: "url", label: "Video URL (YouTube, Vimeo, MP4)", type: "url" }],
    styleGroups: ["spacing", "border"],
    Render: VideoBlock,
  },
  embed: {
    type: "embed",
    label: "Embed / HTML",
    icon: CodeXml,
    category: "Basic",
    description: "Paste custom HTML, an iframe or a third-party embed snippet.",
    defaultProps: { html: "" },
    defaultStyles: { desktop: {} },
    fields: [
      {
        key: "html",
        label: "Embed / HTML code",
        type: "code",
        placeholder: '<iframe src="https://..." width="100%" height="400"></iframe>',
      },
    ],
    styleGroups: ["spacing", "background", "border", "layout"],
    Render: EmbedBlock,
  },
  code: {
    type: "code",
    label: "Code",
    icon: Braces,
    category: "Basic",
    description: "Display a formatted code snippet to your readers.",
    defaultProps: { code: "", language: "" },
    defaultStyles: { desktop: { borderRadius: "12px" } },
    fields: [
      { key: "language", label: "Language label", type: "text", placeholder: "html, js, css…" },
      { key: "code", label: "Code", type: "code", placeholder: "Paste your code…" },
    ],
    styleGroups: ["spacing", "border"],
    Render: CodeBlock,
  },
  list: {
    type: "list",
    label: "List",
    icon: ListIcon,
    category: "Basic",
    defaultProps: {
      items: ["First great point", "Another solid benefit", "And one more"],
      icon: "Check",
      iconColor: "var(--pc-brand, #6366f1)",
    },
    defaultStyles: { desktop: { fontSize: "16px", color: "#334155" } },
    fields: [
      { key: "items", label: "Items", type: "stringlist" },
      { key: "icon", label: "Bullet icon", type: "icon" },
      { key: "iconColor", label: "Icon color", type: "color" },
    ],
    styleGroups: ["typography", "spacing"],
    Render: ListBlock,
  },
  quote: {
    type: "quote",
    label: "Quote",
    icon: QuoteIcon,
    category: "Basic",
    defaultProps: {
      text: "Design is not just what it looks like and feels like. Design is how it works.",
      author: "Steve Jobs",
    },
    defaultStyles: {
      desktop: {
        fontSize: "20px",
        color: "#334155",
        borderColor: "var(--pc-brand, #6366f1)",
        paddingTop: "4px",
        paddingBottom: "4px",
      },
    },
    fields: [
      { key: "text", label: "Quote", type: "textarea" },
      { key: "author", label: "Author", type: "text" },
    ],
    styleGroups: ["typography", "spacing", "border", "background"],
    Render: QuoteBlock,
  },
  file: {
    type: "file",
    label: "File",
    icon: FileText,
    category: "Basic",
    description: "A downloadable file card",
    defaultProps: { url: "", title: "Download file", description: "Click to download", align: "left" },
    defaultStyles: { desktop: {} },
    fields: [
      { key: "url", label: "File", type: "file" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "align", label: "Align", type: "select", options: ALIGN_OPTIONS },
    ],
    styleGroups: ["spacing"],
    Render: FileBlock,
  },

  // --- Sections -------------------------------------------------------------
  navbar: {
    type: "navbar",
    label: "Navbar",
    icon: Navigation,
    category: "Sections",
    description: "Top navigation bar with logo, links and a button",
    defaultProps: {
      brand: "YourBrand",
      links: ["Home", "Features", "Pricing", "About"],
      ctaText: "Get started",
      ctaHref: "#",
    },
    defaultStyles: {
      desktop: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderWidth: "0 0 1px 0", borderStyle: "solid", color: "#0f172a" },
    },
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "links", label: "Nav links", type: "stringlist" },
      { key: "ctaText", label: "Button label", type: "text" },
      { key: "ctaHref", label: "Button link", type: "url" },
    ],
    styleGroups: ["background", "spacing", "typography"],
    Render: NavbarBlock,
  },
  hero: {
    type: "hero",
    label: "Hero",
    icon: PanelTop,
    category: "Sections",
    defaultProps: {
      eyebrow: "Welcome",
      title: "Build something beautiful",
      subtitle: "A clean, modern hero section to introduce your product or idea.",
      buttonText: "Get started",
      buttonHref: "#",
      align: "center",
    },
    defaultStyles: {
      desktop: { backgroundImage: "linear-gradient(135deg, var(--pc-brand, #6366f1), #8b5cf6)", color: "#ffffff" },
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "buttonText", label: "Button label", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
      { key: "align", label: "Align", type: "select", options: ALIGN_OPTIONS },
    ],
    styleGroups: ["background", "spacing", "typography"],
    Render: HeroBlock,
  },
  features: {
    type: "features",
    label: "Feature grid",
    icon: LayoutGrid,
    category: "Sections",
    defaultProps: {
      title: "Everything you need",
      subtitle: "Powerful features that help you move faster.",
      columns: 3,
      items: [
        { icon: "Zap", title: "Lightning fast", text: "Built for speed so your pages load instantly." },
        { icon: "Shield", title: "Secure by default", text: "Best-in-class security baked into every layer." },
        { icon: "Sparkles", title: "Beautiful design", text: "Polished components that look great anywhere." },
      ],
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { label: "2", value: "2" },
          { label: "3", value: "3" },
          { label: "4", value: "4" },
        ],
      },
      {
        key: "items",
        label: "Features",
        type: "items",
        itemFields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text" },
          { key: "text", label: "Text", type: "textarea" },
        ],
      },
    ],
    styleGroups: ["background", "spacing"],
    Render: FeatureGridBlock,
  },
  pricing: {
    type: "pricing",
    label: "Pricing",
    icon: CreditCard,
    category: "Sections",
    defaultProps: {
      title: "Simple pricing",
      subtitle: "Choose the plan that fits.",
      items: [
        { name: "Starter", price: "$0", period: "/mo", features: "1 project\nCommunity support\nBasic blocks", buttonText: "Get started", featured: false },
        { name: "Pro", price: "$19", period: "/mo", features: "Unlimited projects\nPriority support\nAll blocks\nExport HTML", buttonText: "Start free trial", featured: true },
        { name: "Team", price: "$49", period: "/mo", features: "Everything in Pro\nTeam workspaces\nSSO\nAudit logs", buttonText: "Contact sales", featured: false },
      ],
    },
    defaultStyles: { desktop: { backgroundColor: "#f8fafc" } },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      {
        key: "items",
        label: "Plans",
        type: "items",
        itemFields: [
          { key: "name", label: "Name", type: "text" },
          { key: "price", label: "Price", type: "text" },
          { key: "period", label: "Period", type: "text" },
          { key: "features", label: "Features (one per line)", type: "textarea" },
          { key: "buttonText", label: "Button", type: "text" },
          { key: "featured", label: "Featured", type: "boolean" },
        ],
      },
    ],
    styleGroups: ["background", "spacing"],
    Render: PricingBlock,
  },
  testimonial: {
    type: "testimonial",
    label: "Testimonial",
    icon: MessageSquareQuote,
    category: "Sections",
    defaultProps: {
      quote: "This product completely changed how our team works. Couldn't recommend it more.",
      author: "Jamie Rivera",
      role: "Head of Product, Acme",
      avatar: "https://i.pravatar.cc/120?img=12",
      rating: 5,
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      { key: "quote", label: "Quote", type: "textarea" },
      { key: "author", label: "Author", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "avatar", label: "Avatar URL", type: "image" },
      { key: "rating", label: "Rating (1-5)", type: "number" },
    ],
    styleGroups: ["background", "spacing"],
    Render: TestimonialBlock,
  },
  stats: {
    type: "stats",
    label: "Stats",
    icon: BarChart3,
    category: "Sections",
    defaultProps: {
      items: [
        { value: "10k+", label: "Active users" },
        { value: "99.9%", label: "Uptime" },
        { value: "4.9/5", label: "Avg rating" },
        { value: "120+", label: "Countries" },
      ],
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      {
        key: "items",
        label: "Stats",
        type: "items",
        itemFields: [
          { key: "value", label: "Value", type: "text" },
          { key: "label", label: "Label", type: "text" },
        ],
      },
    ],
    styleGroups: ["background", "spacing"],
    Render: StatsBlock,
  },
  cta: {
    type: "cta",
    label: "Call to action",
    icon: Rocket,
    category: "Sections",
    defaultProps: {
      title: "Ready to get started?",
      subtitle: "Join thousands of teams building with us today.",
      buttonText: "Start free",
      buttonHref: "#",
    },
    defaultStyles: {
      desktop: { backgroundImage: "linear-gradient(135deg, var(--pc-brand, #6366f1), #8b5cf6)", color: "#ffffff" },
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "buttonText", label: "Button label", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
    ],
    styleGroups: ["background", "spacing", "typography"],
    Render: CtaBlock,
  },
  footer: {
    type: "footer",
    label: "Footer",
    icon: PanelBottom,
    category: "Sections",
    defaultProps: {
      brand: "YourBrand",
      tagline: "Building the web, one block at a time.",
      links: ["Home", "Features", "Pricing", "About", "Contact"],
      copyright: "© 2026 YourBrand. All rights reserved.",
    },
    defaultStyles: { desktop: { backgroundColor: "#0f172a", color: "#ffffff" } },
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "links", label: "Nav links", type: "stringlist" },
      { key: "copyright", label: "Copyright", type: "text" },
    ],
    styleGroups: ["background", "spacing", "typography"],
    Render: FooterBlock,
  },
  form: {
    type: "form",
    label: "Form",
    icon: Mail,
    category: "Sections",
    description: "Contact form with submissions inbox",
    defaultProps: {
      title: "Get in touch",
      description: "We'll get back to you within one business day.",
      submitText: "Send message",
      successMessage: "Thanks! Your message has been sent.",
      formId: "contact",
      fields: [
        { label: "Name", type: "text", required: true },
        { label: "Email", type: "email", required: true },
        { label: "Message", type: "textarea", required: false },
      ],
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "fields",
        label: "Form fields",
        type: "items",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          {
            key: "type",
            label: "Type",
            type: "select",
            options: [
              { label: "Text", value: "text" },
              { label: "Email", value: "email" },
              { label: "Phone", value: "tel" },
              { label: "Number", value: "number" },
              { label: "Textarea", value: "textarea" },
            ],
          },
          { key: "required", label: "Required", type: "boolean" },
        ],
      },
      { key: "submitText", label: "Button text", type: "text" },
      { key: "successMessage", label: "Success message", type: "textarea" },
    ],
    styleGroups: ["background", "spacing"],
    Render: FormBlock,
  },

  // --- Dynamic (CMS) --------------------------------------------------------
  collection: {
    type: "collection",
    label: "Collection List",
    icon: Database,
    category: "Dynamic",
    description: "Repeat a card across a CMS collection's items",
    defaultProps: {
      collectionId: "",
      layout: "grid",
      columns: "3",
      limit: 0,
      bindings: { image: "", title: "", subtitle: "", text: "", link: "" },
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [],
    styleGroups: ["background", "spacing"],
    Render: CollectionListBlock,
    CustomContent: CollectionInspector,
  },
};

export const CATEGORIES: { name: BlockCategory; types: string[] }[] = [
  { name: "Layout", types: ["section", "columns", "spacer", "divider"] },
  { name: "Basic", types: ["heading", "text", "button", "image", "icon", "video", "list", "quote", "file", "embed", "code"] },
  { name: "Sections", types: ["navbar", "hero", "features", "pricing", "testimonial", "stats", "cta", "form", "footer"] },
  { name: "Dynamic", types: ["collection"] },
];

export function getDefinition(type: string): BlockDefinition | undefined {
  return REGISTRY[type];
}

/** Build a synced component-instance block (not in the registry). */
export function createComponentInstance(componentId: string): Block {
  return {
    id: uid(),
    type: "component",
    props: { componentId },
    styles: {},
    children: [],
  };
}

/** Build a fresh block instance from its registry definition. */
export function createBlock(type: string): Block {
  const def = REGISTRY[type];
  if (!def) throw new Error(`Unknown block type: ${type}`);
  return {
    id: uid(),
    type,
    props: JSON.parse(JSON.stringify(def.defaultProps ?? {})),
    styles: JSON.parse(JSON.stringify(def.defaultStyles ?? {})),
    children: def.createChildren ? def.createChildren() : [],
  };
}
