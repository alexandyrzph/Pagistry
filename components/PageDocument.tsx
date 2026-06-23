import { prisma } from "@/lib/prisma";
import { parseContent } from "@/lib/page-service";
import { responsiveCss } from "@/lib/blocks/styles";
import { designSystemCss, parseDesignSystem } from "@/lib/design/design-system";
import { themeVars, parseTheme } from "@/lib/design/theme";
import { buildCollectionMap } from "@/lib/cms/collection-service";
import { BlockRenderer, type ComponentMap } from "@/components/BlockRenderer";

type PageRow = { content: string; theme: string; siteId: string };

/**
 * Renders a page exactly as the public site does — used by the public route
 * (`/p/[slug]`).
 * Pass `animate={false}` for screenshots so the capture is the final frame.
 */
export async function PageDocument({ page, animate = true }: { page: PageRow; animate?: boolean }) {
  const tree = parseContent(page.content);
  const theme = parseTheme(page.theme);

  const site = await prisma.site.findFirst({ where: { id: page.siteId } });
  const header = site ? parseContent(site.header) : [];
  const footer = site ? parseContent(site.footer) : [];
  const ds = parseDesignSystem(site);

  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...tree, ...footer]);

  const comps = await prisma.component.findMany({ where: { siteId: page.siteId } });
  const components: ComponentMap = {};
  for (const c of comps) {
    try {
      components[c.id] = { content: JSON.parse(c.content) };
    } catch {
      components[c.id] = { content: [] };
    }
  }

  const collectionRows = await prisma.collection.findMany({
    where: { siteId: page.siteId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const collections = buildCollectionMap(collectionRows);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main style={themeVars(theme)}>
        {header.length > 0 && (
          <BlockRenderer
            tree={header}
            viewport="desktop"
            animate={animate}
            inlineStyles={false}
            components={components}
            collections={collections}
          />
        )}
        <BlockRenderer
          tree={tree}
          viewport="desktop"
          animate={animate}
          inlineStyles={false}
          components={components}
          collections={collections}
        />
        {footer.length > 0 && (
          <BlockRenderer
            tree={footer}
            viewport="desktop"
            animate={animate}
            inlineStyles={false}
            components={components}
            collections={collections}
          />
        )}
      </main>
    </>
  );
}
