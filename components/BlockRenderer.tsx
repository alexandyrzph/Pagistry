"use client";

import { motion, type Variants } from "framer-motion";
import { getDefinition } from "@/lib/registry";
import { resolveStyles, blockHtmlId, blockHtmlClass } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Block, CollectionMap, Viewport } from "@/lib/types";
import { CollectionsProvider } from "@/components/editor/collections-context";

// Clean, chrome-free renderer used by the live preview and the public page.
// The editor has its own recursive renderer that adds selection/drag chrome.

const noop = () => {};

export type ComponentMap = Record<string, { content: Block[] }>;

const VARIANTS: Record<string, Variants> = {
  "fade-up": { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0 } },
  "fade-in": { hidden: { opacity: 0 }, show: { opacity: 1 } },
  "zoom-in": { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } },
  "slide-left": { hidden: { opacity: 0, x: 48 }, show: { opacity: 1, x: 0 } },
  "slide-right": { hidden: { opacity: 0, x: -48 }, show: { opacity: 1, x: 0 } },
};

function Reveal({
  animation,
  delay,
  children,
}: {
  animation: string;
  delay: number;
  children: React.ReactNode;
}) {
  const v = VARIANTS[animation];
  if (!v) return <>{children}</>;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={v}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function RenderNode({
  block,
  viewport,
  animate,
  components,
  seen,
  inlineStyles,
}: {
  block: Block;
  viewport: Viewport;
  animate: boolean;
  components: ComponentMap;
  seen: Set<string>;
  inlineStyles: boolean;
}) {
  // Synced component instance — render the master content in place.
  if (block.type === "component") {
    const cid = block.props?.componentId as string | undefined;
    const comp = cid ? components[cid] : undefined;
    if (!cid || !comp || seen.has(cid)) return null;
    const next = new Set(seen);
    next.add(cid);
    return (
      <>
        {comp.content.map((c) => (
          <RenderNode key={c.id} block={c} viewport={viewport} animate={animate} components={components} seen={next} inlineStyles={inlineStyles} />
        ))}
      </>
    );
  }

  const def = getDefinition(block.type);
  if (!def) return null;
  const Cmp = def.Render;
  // When inlineStyles is off, the per-block `.b-<id>` stylesheet (with @media
  // overrides) drives all styling so real breakpoints resolve correctly.
  const style = inlineStyles ? resolveStyles(block.styles, viewport) : {};
  const textStyle = block.props?.textStyle as string | undefined;
  const className = cn(`b-${block.id}`, textStyle && `ts-${textStyle}`, blockHtmlClass(block));
  const htmlId = blockHtmlId(block);
  const children = def.isContainer
    ? block.children.map((c) => (
        <RenderNode key={c.id} block={c} viewport={viewport} animate={animate} components={components} seen={seen} inlineStyles={inlineStyles} />
      ))
    : undefined;

  const el = (
    <Cmp
      block={block}
      viewport={viewport}
      editable={false}
      selected={false}
      style={style}
      className={className}
      id={htmlId}
      setProp={noop}
    >
      {children}
    </Cmp>
  );

  const animation = block.props?.animation as string | undefined;
  if (animate && animation && animation !== "none") {
    return (
      <Reveal animation={animation} delay={Number(block.props?.animationDelay) || 0}>
        {el}
      </Reveal>
    );
  }
  return el;
}

export function BlockRenderer({
  tree,
  viewport = "desktop",
  animate = false,
  components = {},
  collections,
  inlineStyles = true,
}: {
  tree: Block[];
  viewport?: Viewport;
  animate?: boolean;
  components?: ComponentMap;
  /**
   * Collection data for any Collection List blocks. When provided, it's exposed
   * via context for this subtree (public page, preview, export). When omitted,
   * the ambient editor context is inherited untouched.
   */
  collections?: CollectionMap;
  /**
   * When true (default) each block gets its current-viewport styles inlined.
   * When false, styling comes purely from the `.b-<id>` stylesheet (base +
   * @media), so true responsive breakpoints work — used in the iframe preview
   * and on the published page where the responsive CSS is injected.
   */
  inlineStyles?: boolean;
}) {
  const content = (
    <>
      {tree.map((b) => (
        <RenderNode
          key={b.id}
          block={b}
          viewport={viewport}
          animate={animate}
          components={components}
          seen={new Set()}
          inlineStyles={inlineStyles}
        />
      ))}
    </>
  );

  if (!collections) return content;
  return (
    <CollectionsProvider
      value={{ list: Object.values(collections), map: collections, refresh: async () => {} }}
    >
      {content}
    </CollectionsProvider>
  );
}
