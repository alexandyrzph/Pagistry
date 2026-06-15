"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Component as ComponentIcon } from "lucide-react";
import { getDefinition } from "@/lib/registry";
import { blockHtmlClass, blockHtmlId } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { BlockRenderer } from "@/components/BlockRenderer";
import { Slot, EmptyDrop } from "./Slot";
import { useDrag } from "./drag-context";
import { useComponents } from "./components-context";

export function SlottedChildren({
  parentId,
  parentType,
  items,
  emptyMinHeight,
}: {
  parentId: string | null;
  parentType: string | null;
  items: Block[];
  emptyMinHeight?: number;
}) {
  if (items.length === 0) {
    return <EmptyDrop parentId={parentId} parentType={parentType} minHeight={emptyMinHeight} />;
  }
  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((child, i) => (
          <EditorBlock key={child.id} block={child} parentId={parentId} parentType={parentType} index={i} />
        ))}
      </AnimatePresence>
      <Slot parentId={parentId} parentType={parentType} index={items.length} />
    </>
  );
}

// A block inside the editable canvas. The visual content lives here (portaled
// into the iframe); selection chrome + the toolbar/drag-handle are drawn by the
// top-document CanvasOverlay, anchored to this node's `data-block-id`.
export function EditorBlock({
  block,
  parentId,
  parentType,
  index,
}: {
  block: Block;
  parentId: string | null;
  parentType: string | null;
  index: number;
}) {
  const components = useComponents();
  const def = getDefinition(block.type);
  const isComponent = block.type === "component";
  const comp = isComponent ? components.map[block.props?.componentId] : undefined;

  const viewport = useEditor((s) => s.viewport);
  const setProp = useEditor((s) => s.setProp);
  const isNew = useEditor((s) => s.lastAddedId === block.id);
  const clearLastAdded = useEditor((s) => s.clearLastAdded);
  const drag = useDrag();
  const isDragging = drag.id === block.id;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew) return;
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      clearLastAdded();
    });
    return () => cancelAnimationFrame(raf);
  }, [isNew, clearLastAdded]);

  if (!isComponent && !def) return null;

  // --- body -----------------------------------------------------------------
  let body: ReactNode;
  if (isComponent) {
    body = (
      <div className="pointer-events-none">
        {comp ? (
          <BlockRenderer tree={comp.content} viewport={viewport} inlineStyles={false} components={components.map} />
        ) : (
          <div className="flex items-center justify-center gap-2 bg-violet-50 p-8 text-sm font-medium text-violet-500">
            <ComponentIcon size={16} /> Component not found
          </div>
        )}
      </div>
    );
  } else {
    const Cmp = def!.Render;
    let children: ReactNode = undefined;
    if (def!.type === "columns") {
      children = block.children.map((c, i) => (
        <EditorBlock key={c.id} block={c} parentId={block.id} parentType="columns" index={i} />
      ));
    } else if (def!.isContainer) {
      children = (
        <SlottedChildren
          parentId={block.id}
          parentType={block.type}
          items={block.children}
          emptyMinHeight={block.type === "column" ? 64 : 80}
        />
      );
    }
    body = (
      // style is intentionally empty — the injected responsive stylesheet
      // (.b-<id> base + @media) drives styling so breakpoints resolve live.
      <Cmp
        block={block}
        viewport={viewport}
        editable
        selected={false}
        style={{}}
        className={cn(`b-${block.id}`, block.props?.textStyle && `ts-${block.props.textStyle}`, blockHtmlClass(block))}
        id={blockHtmlId(block)}
        setProp={(k, v) => setProp(block.id, k, v)}
      >
        {children}
      </Cmp>
    );
  }

  return (
    <motion.div
      ref={ref}
      data-block-id={block.id}
      data-block-type={block.type}
      data-is-component={isComponent ? "1" : undefined}
      layout={drag.type ? false : "position"}
      initial={isNew ? { opacity: 0, y: 16, scale: 0.97 } : false}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.7 }}
      className="relative"
    >
      <Slot parentId={parentId} parentType={parentType} index={index} />
      {body}
    </motion.div>
  );
}
