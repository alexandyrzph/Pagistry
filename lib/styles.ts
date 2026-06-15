import type { CSSProperties } from "react";
import type { Block, ResponsiveStyles, StyleProps, Viewport } from "./types";

// ---------------------------------------------------------------------------
// Turn the per-viewport style model into something renderable.
//
//  - resolveStyles(): merged inline CSS for ONE viewport (used by the editor
//    canvas, which previews a single viewport at a time). Desktop-first cascade.
//  - responsiveCss(): a stylesheet with @media overrides for tablet/mobile,
//    scoped per block via `.b-<id>` (used by the public page and HTML export).
// ---------------------------------------------------------------------------

export const BREAKPOINTS = { tablet: 1024, mobile: 640 };

// --- Author custom attributes (per-block HTML id + extra classes) -----------

/** Sanitized HTML id an author set on a block (spaces → dashes), or undefined. */
export function blockHtmlId(block: Block): string | undefined {
  const raw = (block.props?.htmlId as string | undefined)?.trim();
  return raw ? raw.replace(/\s+/g, "-") : undefined;
}

/** Extra CSS class string an author set on a block (space-separated), or "". */
export function blockHtmlClass(block: Block): string {
  return (block.props?.htmlClass as string | undefined)?.trim() ?? "";
}

/** Wrap a bare image URL so it works as a CSS background-image value. */
function normalizeBg(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (/^(url\(|linear-gradient|radial-gradient|conic-gradient|none)/.test(v)) {
    return v;
  }
  return `url("${v}")`;
}

function applyStyle(out: Record<string, string>, sp: StyleProps) {
  for (const [k, raw] of Object.entries(sp)) {
    if (raw == null || raw === "") continue;
    let value = String(raw);
    if (k === "backgroundImage") value = normalizeBg(value);
    out[k] = value;
  }
}

/** Merged inline styles for a single viewport (desktop-first cascade). */
export function resolveStyles(
  styles: ResponsiveStyles,
  viewport: Viewport
): CSSProperties {
  const out: Record<string, string> = {};
  if (styles.desktop) applyStyle(out, styles.desktop);
  if (viewport === "tablet" || viewport === "mobile") {
    if (styles.tablet) applyStyle(out, styles.tablet);
  }
  if (viewport === "mobile") {
    if (styles.mobile) applyStyle(out, styles.mobile);
  }
  return out as CSSProperties;
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Serialize a StyleProps object into a CSS declaration string. */
export function styleDeclarations(sp: StyleProps): string {
  return cssText(sp);
}

function cssText(sp: StyleProps): string {
  const parts: string[] = [];
  for (const [k, raw] of Object.entries(sp)) {
    if (raw == null || raw === "") continue;
    let value = String(raw);
    if (k === "backgroundImage") value = normalizeBg(value);
    parts.push(`${camelToKebab(k)}: ${value};`);
  }
  return parts.join(" ");
}

/** Collect every block's id + styles (depth-first) for stylesheet generation. */
function flatten(tree: Block[], acc: Block[] = []): Block[] {
  for (const b of tree) {
    acc.push(b);
    flatten(b.children, acc);
  }
  return acc;
}

/**
 * Build a scoped stylesheet for the whole tree. Desktop rules are emitted as
 * base; tablet/mobile rules go inside max-width media queries so the published
 * page is genuinely responsive.
 */
export function responsiveCss(
  tree: Block[],
  opts: { editable?: boolean } = {}
): string {
  const blocks = flatten(tree);
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  // Per-breakpoint visibility: collect selectors hidden at each device range.
  const hideDesktop: string[] = [];
  const hideTablet: string[] = [];
  const hideMobile: string[] = [];

  for (const b of blocks) {
    const sel = `.b-${b.id}`;
    if (b.styles.desktop) {
      const t = cssText(b.styles.desktop);
      if (t) base.push(`${sel} { ${t} }`);
    }
    if (b.styles.tablet) {
      const t = cssText(b.styles.tablet);
      if (t) tablet.push(`${sel} { ${t} }`);
    }
    if (b.styles.mobile) {
      const t = cssText(b.styles.mobile);
      if (t) mobile.push(`${sel} { ${t} }`);
    }
    const hidden = b.props?.hidden as
      | { desktop?: boolean; tablet?: boolean; mobile?: boolean }
      | undefined;
    if (hidden?.desktop) hideDesktop.push(sel);
    if (hidden?.tablet) hideTablet.push(sel);
    if (hidden?.mobile) hideMobile.push(sel);
  }

  let css = base.join("\n");
  if (tablet.length) {
    css += `\n@media (max-width: ${BREAKPOINTS.tablet}px) {\n${tablet.join("\n")}\n}`;
  }
  if (mobile.length) {
    css += `\n@media (max-width: ${BREAKPOINTS.mobile}px) {\n${mobile.join("\n")}\n}`;
  }

  // Visibility uses *bounded* device ranges so each breakpoint toggles
  // independently. On the public page a hidden block is removed (display:none);
  // in the editor it's kept as a selectable ghost so authors can re-show it.
  const hideDecl = opts.editable
    ? "opacity: 0.35 !important; outline: 1px dashed rgba(99,102,241,0.7); outline-offset: -1px;"
    : "display: none !important;";
  const rules = (sels: string[]) => sels.map((s) => `${s} { ${hideDecl} }`).join("\n");
  if (hideDesktop.length) {
    css += `\n@media (min-width: ${BREAKPOINTS.tablet + 1}px) {\n${rules(hideDesktop)}\n}`;
  }
  if (hideTablet.length) {
    css += `\n@media (min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px) {\n${rules(hideTablet)}\n}`;
  }
  if (hideMobile.length) {
    css += `\n@media (max-width: ${BREAKPOINTS.mobile}px) {\n${rules(hideMobile)}\n}`;
  }
  return css;
}
