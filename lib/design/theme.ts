import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

/**
 * Convert design tokens into inline CSS — custom properties that blocks read
 * via var(--pc-brand) / var(--pc-radius), plus a cascading font-family.
 */
export function themeVars(theme: Theme | undefined): CSSProperties {
  const s: Record<string, string> = {};
  if (theme?.brand) s["--pc-brand"] = theme.brand;
  if (theme?.radius) s["--pc-radius"] = theme.radius;
  if (theme?.font) s.fontFamily = theme.font;
  return s as CSSProperties;
}

export function parseTheme(json: string | null | undefined): Theme {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Theme) : {};
  } catch {
    return {};
  }
}
