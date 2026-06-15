import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BASE = "https://pagecraft.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await prisma.page.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...pages.map((p) => ({
      url: `${BASE}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
