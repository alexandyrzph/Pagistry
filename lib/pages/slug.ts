import { slugify } from "@/lib/utils";

export function pageSlugFrom(input: string): string {
  const trimmed = (input ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  return slugify(trimmed);
}
