import type { PrismaClient } from "@prisma/client";
import { pageSlugFrom } from "./slug";

export async function validatePageSlug(
  db: PrismaClient,
  siteId: string,
  pageId: string,
  input: string,
): Promise<string> {
  const slug = pageSlugFrom(input);
  if (!slug) throw new Error("slug_empty");
  const clash = await db.page.findFirst({ where: { siteId, slug, NOT: { id: pageId } } });
  if (clash) throw new Error("slug_taken");
  return slug;
}
