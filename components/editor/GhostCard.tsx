"use client";

import { motion } from "framer-motion";
import { getDefinition } from "@/lib/registry";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { BlockRenderer, type ComponentMap } from "@/components/BlockRenderer";
import { Wireframe } from "./Wireframe";

/** Cursor-following preview card of the block being dragged. */
export const GHOST_W = 300;
export const GHOST_H = 184;
export const GHOST_STAGE = 1024;

export function GhostCard({ block, components }: { block: Block; components: ComponentMap }) {
  const isComponent = block.type === "component";
  const def = getDefinition(block.type);
  const accent = isComponent ? "ring-violet-400/70" : "ring-indigo-400/70";

  // Every block shows a clean labeled wireframe card.
  if (!isComponent && def) {
    const Icon = def.icon;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1, rotate: -2 }}
        transition={{ type: "spring", stiffness: 520, damping: 30 }}
        className={cn("pointer-events-none w-[220px] rounded-xl bg-white p-3 shadow-2xl ring-2", accent)}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Icon size={16} />
          </span>
          <span className="text-sm font-semibold text-zinc-800">{def.label}</span>
        </div>
        <div className="mt-3">
          <Wireframe block={block} />
        </div>
      </motion.div>
    );
  }

  // Content blocks / components → faithful scaled thumbnail.
  const scale = GHOST_W / GHOST_STAGE;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1, rotate: -2 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className={cn("pointer-events-none relative overflow-hidden rounded-xl bg-white shadow-2xl ring-2", accent)}
      style={{ width: GHOST_W, height: GHOST_H }}
    >
      <div style={{ width: GHOST_STAGE, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <BlockRenderer tree={[block]} viewport="desktop" components={components} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/90 to-transparent" />
    </motion.div>
  );
}
