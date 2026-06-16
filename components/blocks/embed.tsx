"use client";

import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/registry-types";

export { embedBlocks } from "./embed.defs";

// --- Embed / Custom HTML ----------------------------------------------------
// Injects author-authored raw HTML (iframes, widgets, custom markup). This is
// the site owner's own code — like Webflow's HTML Embed — so it is rendered
// verbatim. NOTE: <script> tags set via innerHTML do not auto-execute; iframe
// and markup embeds work. In the editor the content is made pointer-inert so
// the block stays selectable.

export function EmbedBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const html = (block.props.html as string) || "";

  if (!html.trim()) {
    if (editable) {
      return (
        <div
          id={id}
          className={cn("w-full", className)}
          style={style}
        >
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-zinc-400">
            <Code2 size={20} />
            <p className="text-sm font-medium text-zinc-500">Embed / HTML</p>
            <p className="text-xs">Paste embed or HTML code in the inspector.</p>
          </div>
        </div>
      );
    }
    return <div id={id} className={cn("w-full", className)} style={style} />;
  }

  if (editable) {
    // pointer-events-none so an embedded iframe/widget doesn't swallow the
    // editor's selection/drag events.
    return (
      <div id={id} className={cn("w-full", className)} style={style}>
        <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div
      id={id}
      className={cn("w-full", className)}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// --- Code block (displays a formatted snippet to readers) -------------------

export function CodeBlock({ block, style, className, id }: BlockRenderProps) {
  const code = (block.props.code as string) || "";
  const language = (block.props.language as string) || "";

  return (
    <div id={id} className={cn("w-full overflow-hidden rounded-xl", className)} style={style}>
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
        <span className="text-xs font-medium text-zinc-400">{language || "code"}</span>
      </div>
      <pre className="overflow-x-auto bg-zinc-900 px-4 py-3.5 text-sm leading-relaxed text-zinc-100">
        <code className="font-mono">{code || "// your code here"}</code>
      </pre>
    </div>
  );
}

