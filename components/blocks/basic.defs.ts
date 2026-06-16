import { Heading, Type, MousePointerClick, Image as ImageIcon, Star, Video as VideoIcon, List as ListIcon, Quote as QuoteIcon } from "lucide-react";
import type { BlockDefinition } from "@/lib/registry-types";
import {
  HeadingBlock,
  TextBlock,
  ButtonBlock,
  ImageBlock,
  IconBlock,
  VideoBlock,
  ListBlock,
  QuoteBlock,
} from "./basic";

export const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

export const basicBlocks: BlockDefinition[] = [
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
];
