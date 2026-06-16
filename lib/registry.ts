import type { Block, BlockCategory } from "./types";
import type { BlockDefinition } from "./registry-types";
import { uid } from "./utils";

import { layoutBlocks } from "@/components/blocks/layout.defs";
import { basicBlocks } from "@/components/blocks/basic.defs";
import { embedBlocks } from "@/components/blocks/embed.defs";
import { fileBlocks } from "@/components/blocks/file.defs";
import { navbarBlocks } from "@/components/blocks/navbar.defs";
import { formBlocks } from "@/components/blocks/form.defs";
import { sectionBlocks } from "@/components/blocks/sections.defs";
import { collectionBlocks } from "@/components/blocks/collection.defs";

const ALL_BLOCKS: BlockDefinition[] = [
  ...layoutBlocks,
  ...basicBlocks,
  ...embedBlocks,
  ...fileBlocks,
  ...navbarBlocks,
  ...formBlocks,
  ...sectionBlocks,
  ...collectionBlocks,
];

export const REGISTRY: Record<string, BlockDefinition> = Object.fromEntries(
  ALL_BLOCKS.map((def) => [def.type, def]),
);

// Palette grouping + ORDER (intentionally explicit — palette order != definition
// order, and the child-only "column" block is omitted on purpose).
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
    children: (def.defaultChildren ?? []).map((t) => createBlock(t)),
  };
}
