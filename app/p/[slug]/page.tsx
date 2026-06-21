import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageDocument } from "@/components/PageDocument";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

async function loadPage(slug: string) {
  const resolved = await resolveHostSite(await requestHost());
  if (slug === "__home__") {
    if (!resolved?.site.homePageId) return null;
    return prisma.page.findUnique({ where: { id: resolved.site.homePageId } });
  }
  if (resolved) return prisma.page.findFirst({ where: { siteId: resolved.siteId, slug } });
  return prisma.page.findFirst({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: "Page not found" };
  const title = page.metaTitle || page.title;
  const description = page.metaDescription || undefined;
  const images = page.ogImage ? [page.ogImage] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page || !page.published) notFound();
  return <PageDocument page={page} />;
}
