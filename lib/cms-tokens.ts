import type { Block } from "./types";

// ---------------------------------------------------------------------------
// Token substitution for CMS detail pages. A detail template is an ordinary
// block tree where string props may contain {{fieldKey}} placeholders; at
// render time we replace them with the current item's field values.
// ---------------------------------------------------------------------------

const TOKEN = /\{\{\s*([\w-]+)\s*\}\}/g;

function fillString(s: string, data: Record<string, any>): string {
  return s.replace(TOKEN, (_, key) => {
    const v = data[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

function fillValue(v: any, data: Record<string, any>): any {
  if (typeof v === "string") return fillString(v, data);
  if (Array.isArray(v)) return v.map((x) => fillValue(x, data));
  if (v && typeof v === "object") {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) out[k] = fillValue(val, data);
    return out;
  }
  return v;
}

/** Deep-clone a block tree with all {{token}} props filled from `data`. */
export function applyTokens(tree: Block[], data: Record<string, any>): Block[] {
  return tree.map((b) => ({
    ...b,
    props: fillValue(b.props ?? {}, data) as Record<string, any>,
    children: applyTokens(b.children ?? [], data),
  }));
}

/** Does any string prop in the tree reference {{...}}? (used for hints) */
export function hasTokens(tree: Block[]): boolean {
  return JSON.stringify(tree).includes("{{");
}
