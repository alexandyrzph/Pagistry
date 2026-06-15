"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/registry-types";
import { Editable } from "./shared";

export function NavbarBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    brand = "YourBrand",
    links = ["Home", "Features", "Pricing", "About"] as string[],
    ctaText = "Get started",
    ctaHref = "#",
  } = block.props;

  return (
    <nav id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Editable as="span" value={brand} editable={editable} onCommit={(v) => setProp("brand", v)}
          className="text-lg font-bold tracking-tight" />
        <div className="hidden items-center gap-7 md:flex">
          {(links as string[]).map((l, i) => (
            <Editable key={i} as="a" value={l} editable={editable} onCommit={(v) => setProp(`links.${i}`, v)}
              className="cursor-pointer text-sm font-medium no-underline opacity-75 transition-opacity hover:opacity-100" />
          ))}
        </div>
        <a
          href={editable ? undefined : ctaHref}
          onClick={editable ? (e) => e.preventDefault() : undefined}
          style={{ backgroundColor: "var(--pc-brand, #6366f1)", borderRadius: "var(--pc-radius, 10px)" }}
          className="shrink-0 cursor-pointer px-4 py-2 text-sm font-semibold text-white no-underline transition-transform hover:-translate-y-0.5"
        >
          <Editable as="span" value={ctaText} editable={editable} onCommit={(v) => setProp("ctaText", v)} />
        </a>
      </div>
    </nav>
  );
}
