import { prisma } from "./prisma";
import { slugify } from "./utils";
import type { Block } from "./types";

/** Safely parse a stored content string into a block tree. */
export function parseContent(content: string): Block[] {
  try {
    const v = JSON.parse(content);
    return Array.isArray(v) ? (v as Block[]) : [];
  } catch {
    return [];
  }
}

/** Produce a slug derived from `base` that is unique across pages. */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let n = 1;
  // bounded loop; slugs collide rarely
  while (n < 1000) {
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    n++;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}
