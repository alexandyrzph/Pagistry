import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { responsiveCss } from "@/lib/blocks/styles";
import { designSystemCss, parseDesignSystem } from "@/lib/design/design-system";
import { themeVars, parseTheme } from "@/lib/design/theme";
import { buildCollectionMap } from "@/lib/cms/collection-service";
import { BlockRenderer } from "@/components/BlockRenderer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });
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

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page || !page.published) notFound();

  const tree = parseContent(page.content);
  const theme = parseTheme(page.theme);

  // shared site header + footer (scoped to this page's workspace)
  const site = page.workspaceId
    ? await prisma.site.findUnique({ where: { workspaceId: page.workspaceId } })
    : null;
  const header = site ? parseContent(site.header) : [];
  const footer = site ? parseContent(site.footer) : [];
  const ds = parseDesignSystem(site);

  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...tree, ...footer]);

  const comps = await prisma.component.findMany({ where: { workspaceId: page.workspaceId } });
  const components: Record<string, { content: any[] }> = {};
  for (const c of comps) {
    try {
      components[c.id] = { content: JSON.parse(c.content) };
    } catch {
      components[c.id] = { content: [] };
    }
  }

  const collectionRows = await prisma.collection.findMany({
    where: { workspaceId: page.workspaceId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const collections = buildCollectionMap(collectionRows);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
    url: `https://pagecraft.app/p/${slug}`,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main style={themeVars(theme)}>
        {header.length > 0 && (
          <BlockRenderer tree={header} viewport="desktop" animate inlineStyles={false} components={components} collections={collections} />
        )}
        <BlockRenderer tree={tree} viewport="desktop" animate inlineStyles={false} components={components} collections={collections} />
        {footer.length > 0 && (
          <BlockRenderer tree={footer} viewport="desktop" animate inlineStyles={false} components={components} collections={collections} />
        )}
      </main>
    </>
  );
}
