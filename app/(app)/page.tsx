import { prisma } from "@/lib/prisma";
import { requireSite } from "@/lib/auth/site";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { isThumbnailStale } from "@/lib/thumbnails/staleness";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await requireSite();

  const pages = await prisma.page.findMany({
    where: { siteId: ctx.site.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } }, thumbnail: true },
  });
  const dto = pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.published,
    updatedAt: p.updatedAt.toISOString(),
    submissions: p._count.submissions,
    thumbnailUrl: p.thumbnail?.url ?? null,
    thumbnailVersion: p.thumbnail?.takenForUpdatedAt.getTime() ?? null,
    thumbnailStale: isThumbnailStale(p.thumbnail?.takenForUpdatedAt, p.updatedAt),
  }));
  return <Dashboard pages={dto} />;
}
