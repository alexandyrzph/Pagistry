import { Navigation } from "lucide-react";
import type { BlockDefinition } from "@/lib/registry-types";
import { NavbarBlock } from "./navbar";

export const navbarBlocks: BlockDefinition[] = [
  {
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
];
