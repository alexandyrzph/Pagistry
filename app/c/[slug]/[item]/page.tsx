import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { parseItemData, buildCollectionMap } from "@/lib/collection-service";
import { applyTokens } from "@/lib/cms-tokens";
import { responsiveCss } from "@/lib/styles";
import { designSystemCss, parseDesignSystem } from "@/lib/design-system";
import { BlockRenderer } from "@/components/BlockRenderer";

export const dynamic = "force-dynamic";

async function load(slug: string, itemId: string) {
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection || !collection.detailEnabled) return null;
  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });
  if (!item || item.collectionId !== collection.id) return null;
  return { collection, item };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; item: string }>;
}): Promise<Metadata> {
  const { slug, item } = await params;
  const found = await load(slug, item);
  if (!found) return { title: "Not found" };
  const data = parseItemData(found.item.data);
  const title = data.title || data.name || found.collection.name;
  return { title, description: data.excerpt || data.description || undefined };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; item: string }>;
}) {
  const { slug, item } = await params;
  const found = await load(slug, item);
  if (!found) notFound();

  const data = parseItemData(found.item.data);
  const template = parseContent(found.collection.detailTemplate);
  const tree = applyTokens(template, data);

  // header / footer + components + collections, scoped to the collection's workspace
  const workspaceId = found.collection.workspaceId;
  const site = workspaceId
    ? await prisma.site.findUnique({ where: { workspaceId } })
    : null;
  const header = site ? parseContent(site.header) : [];
  const footer = site ? parseContent(site.footer) : [];

  const comps = await prisma.component.findMany({ where: { workspaceId } });
  const components: Record<string, { content: any[] }> = {};
  for (const c of comps) {
    try {
      components[c.id] = { content: JSON.parse(c.content) };
    } catch {
      components[c.id] = { content: [] };
    }
  }
  const collectionRows = await prisma.collection.findMany({
    where: { workspaceId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const collections = buildCollectionMap(collectionRows);
  const ds = parseDesignSystem(site);

  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...tree, ...footer]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main>
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
