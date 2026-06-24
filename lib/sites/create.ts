import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

async function uniqueHandle(workspaceId: string, name: string, db: Db): Promise<string> {
  const base = slugify(name) || "site";
  for (let n = 1; n < 1000; n++) {
    const handle = n === 1 ? base : `${base}-${n}`;
    const existing = await db.site.findFirst({ where: { workspaceId, handle } });
    if (!existing) return handle;
  }
  return `${base}-${Date.now()}`;
}

export async function createSite(
  {
    workspaceId,
    name,
    logoUrl,
    faviconUrl,
  }: { workspaceId: string; name: string; logoUrl?: string | null; faviconUrl?: string | null },
  db: Db = prisma,
) {
  const cleanName = (name || "Untitled site").trim().slice(0, 80) || "Untitled site";
  const handle = await uniqueHandle(workspaceId, cleanName, db);
  const site = await db.site.create({
    data: { workspaceId, name: cleanName, handle, logoUrl: logoUrl ?? null, faviconUrl: faviconUrl ?? null },
  });
  const home = await db.page.create({
    data: { title: "Home", slug: "home", siteId: site.id, published: false },
  });
  await db.site.update({ where: { id: site.id }, data: { homePageId: home.id } });
  return { id: site.id, name: site.name, handle: site.handle, homePageId: home.id };
}
