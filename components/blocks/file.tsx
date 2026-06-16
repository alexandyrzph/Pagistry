"use client";

import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { Editable } from "./shared";

export function FileBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const { url = "", title = "Download file", description = "Click to download", align = "left" } = block.props;
  const name = url ? url.split("/").pop() : "";
  const alignCls = align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : "";

  return (
    <div id={id} className={cn("w-full", className)} style={style}>
      <a
        href={editable || !url ? undefined : url}
        download
        onClick={editable ? (e) => e.preventDefault() : undefined}
        className={cn(
          "flex max-w-md cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 no-underline shadow-sm transition-shadow hover:shadow-md",
          alignCls
        )}
        style={{ borderRadius: "var(--pc-radius, 12px)" }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: "var(--pc-brand, #6366f1)" }}
        >
          <FileText size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <Editable as="div" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
            className="truncate text-sm font-semibold text-slate-900" />
          <Editable as="div" value={description} editable={editable} onCommit={(v) => setProp("description", v)}
            className="truncate text-xs text-slate-400" />
          {name && !editable && <span className="sr-only">{name}</span>}
        </span>
        <Download size={18} className="shrink-0 text-slate-400" />
      </a>
      {editable && !url && (
        <p className="mt-1.5 text-xs text-slate-400">Upload a file in the inspector →</p>
      )}
    </div>
  );
}

