"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BlockRenderer } from "@/components/BlockRenderer";
import type { Block } from "@/lib/types";

// Render the template at a real desktop width, then scale the whole stage down
// to fit the card. A fixed width keeps responsive (`md:`) utilities resolving as
// "desktop", which is what these thumbnails should show.
const STAGE_WIDTH = 1280;

/**
 * A scaled, non-interactive thumbnail of a single template's page. Reuses the
 * shared BlockRenderer (same output as the published page) with animations off
 * and styles inlined, so the preview is self-contained — no global CSS, no
 * leakage into the surrounding modal. An empty tree renders a placeholder.
 */
export function TemplatePreview({ blocks }: { blocks: Block[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const measure = () => setWidth(boxRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (blocks.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
        <Plus size={20} aria-hidden="true" />
        <span className="text-[11px] font-medium">Empty canvas</span>
      </div>
    );
  }

  const scale = width ? width / STAGE_WIDTH : 0;

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className="pointer-events-none aspect-[16/10] w-full overflow-hidden rounded-lg border border-zinc-200 bg-white"
    >
      <div style={{ width: STAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <BlockRenderer
          tree={blocks}
          viewport="desktop"
          animate={false}
          inlineStyles
          components={{}}
          collections={{}}
        />
      </div>
    </div>
  );
}
