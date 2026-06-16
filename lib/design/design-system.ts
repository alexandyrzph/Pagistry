import type { ColorToken, DesignSystem, TextStyle } from "@/lib/types";
import { styleDeclarations } from "@/lib/blocks/styles";

/** Parse the Site row's stored JSON into a usable design system. */
export function parseDesignSystem(site: {
  colors?: string | null;
  textStyles?: string | null;
} | null | undefined): DesignSystem {
  const arr = (json: string | null | undefined) => {
    if (!json) return [];
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  return { colors: arr(site?.colors), textStyles: arr(site?.textStyles) };
}

// ---------------------------------------------------------------------------
// Site-wide design system → CSS.
//
//  - Color tokens become CSS custom properties on <body> (`--pc-color-<id>`),
//    so blocks that store `var(--pc-color-<id>)` update live when the token
//    value changes.
//  - Text styles become single-class rules (`.ts-<id>`). A linked block carries
//    both `ts-<id>` and `b-<id>` classes; emit text-style rules BEFORE the
//    per-block `.b-<id>` rules so a block's own overrides always win (equal
//    specificity → source order decides).
// ---------------------------------------------------------------------------

export function designSystemCss(
  colors: ColorToken[] = [],
  textStyles: TextStyle[] = []
): string {
  const parts: string[] = [];

  const vars = colors
    .filter((c) => c && c.id && c.value)
    .map((c) => `--pc-color-${c.id}: ${c.value};`)
    .join(" ");
  if (vars) parts.push(`body { ${vars} }`);

  for (const ts of textStyles) {
    if (!ts || !ts.id) continue;
    const decl = styleDeclarations(ts.props ?? {});
    if (decl) parts.push(`.ts-${ts.id} { ${decl} }`);
  }

  return parts.join("\n");
}
