"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
} from "@dnd-kit/core";
import type { Block, Seo, Theme } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { BlockRenderer } from "@/components/BlockRenderer";
import { DragProvider } from "./drag-context";
import { useDragDropManager } from "./use-drag-drop";
import { ComponentsProvider } from "./components-context";
import { CollectionsProvider } from "./collections-context";
import { SiteProvider } from "./site-context";
import { EditorActionsProvider } from "./editor-actions";
import { useEditorData } from "./use-editor-data";
import { useEditorPersistence } from "./use-editor-persistence";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { usePageNavigation } from "./use-page-navigation";
import { IframeProvider, type FrameInfo } from "./iframe-context";
import { CanvasOverlay } from "./CanvasOverlay";
import { SelectionBreadcrumb } from "./SelectionBreadcrumb";
import { DomTreePanel } from "./DomTreePanel";
import { UnsavedModal } from "./UnsavedModal";
import { SaveComponentModal } from "./SaveComponentModal";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { Canvas } from "./Canvas";
import { FloatingInspector } from "./Inspector";
import { EditorSkeleton } from "./EditorSkeleton";
import { CommandPalette } from "./CommandPalette";
import { GhostCard } from "./GhostCard";
import { ContextMenu } from "./ContextMenu";
import { SectionInserter } from "./SectionInserter";
import { AiGenerateModal } from "./AiGenerateModal";
import { RichTextToolbar } from "./RichTextToolbar";
import { VersionHistory } from "./VersionHistory";

export type PageDTO = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  content: Block[];
  seo?: Seo;
  theme?: Theme;
};

export function EditorClient({
  page,
  mode = "page",
  siteRegion,
}: {
  page: PageDTO;
  mode?: "page" | "component" | "site" | "collection";
  siteRegion?: "header" | "footer";
}) {
  const isComponentMode = mode === "component";
  const isSiteMode = mode === "site";
  const isCollectionMode = mode === "collection";
  const init = useEditor((s) => s.init);
  const tree = useEditor((s) => s.tree);

  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Canvas iframe handle shared with the selection overlay + inspector.
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [frameTick, setFrameTick] = useState(0);
  const frameRef = useRef<FrameInfo | null>(null);
  const registerFrame = useCallback((f: FrameInfo | null) => {
    frameRef.current = f;
    setFrame(f);
  }, []);
  const bumpFrame = useCallback(() => setFrameTick((t) => t + 1), []);
  const iframeCtx = useMemo(
    () => ({ frame, tick: frameTick, register: registerFrame, bump: bumpFrame }),
    [frame, frameTick, registerFrame, bumpFrame]
  );

  const { drag, sensors, measure, onDragStart, onDragEnd, onDragCancel } = useDragDropManager(frameRef);

  const { componentsCtx, collectionsCtx, siteCtx, componentsMap, collectionsMap, refreshComponents } =
    useEditorData(mode);

  useEffect(() => {
    init({
      id: page.id,
      title: page.title,
      slug: page.slug,
      published: page.published,
      tree: page.content,
      seo: page.seo,
      theme: page.theme,
    });
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brief readiness gate so the loading skeleton is perceptible (incl. on refresh).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 550);
    return () => clearTimeout(t);
  }, []);

  // --- persistence ----------------------------------------------------------
  const { save, publish, unpublish, exportHtml, exportRef } = useEditorPersistence({
    isSiteMode,
    isCollectionMode,
    isComponentMode,
    siteRegion,
  });

  // --- in-place page switching + component save ----------------------------
  const { actionsCtx, pending, setPending, saveCompBlock, setSaveCompBlock, persistComponent } =
    usePageNavigation({ refreshComponents });

  useKeyboardShortcuts({ save, togglePalette: () => setPaletteOpen((o) => !o), frame });

  if (!ready) return <EditorSkeleton />;

  return (
    <IframeProvider value={iframeCtx}>
    <ComponentsProvider value={componentsCtx}>
    <CollectionsProvider value={collectionsCtx}>
    <SiteProvider value={siteCtx}>
    <EditorActionsProvider value={actionsCtx}>
    <DragProvider value={drag}>
      <DndContext
        id="pagebuilder-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{
          droppable: { strategy: MeasuringStrategy.WhileDragging, measure },
          draggable: { measure },
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex h-screen flex-col overflow-clip overscroll-none bg-zinc-100">
          <TopBar
            mode={mode}
            onSave={save}
            onExport={exportHtml}
            onPublish={publish}
            onUnpublish={unpublish}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
          />
          <div className="flex min-h-0 flex-1">
            <LeftPanel />
            <Canvas />
          </div>
          <FloatingInspector />
          <CanvasOverlay />
          <SelectionBreadcrumb />
          <DomTreePanel />
        </div>

        <DragOverlay dropAnimation={null}>
          {drag.ghost ? <GhostCard block={drag.ghost} components={componentsMap} /> : null}
        </DragOverlay>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSave={save}
          onExport={exportHtml}
          onPublish={publish}
        />
      </DndContext>

      {/* hidden clean render used by HTML export */}
      <div ref={exportRef} className="hidden" aria-hidden>
        <BlockRenderer tree={tree} viewport="desktop" inlineStyles={false} components={componentsMap} collections={collectionsMap} />
      </div>

      <UnsavedModal
        open={!!pending}
        onCancel={() => setPending(null)}
        onDiscard={() => {
          useEditor.setState({ dirty: false });
          pending?.run();
          setPending(null);
        }}
        onSave={async () => {
          await save();
          pending?.run();
          setPending(null);
        }}
      />

      <SaveComponentModal
        open={!!saveCompBlock}
        defaultName="New component"
        onCancel={() => setSaveCompBlock(null)}
        onSave={persistComponent}
      />

      <ContextMenu />
      <SectionInserter />
      <AiGenerateModal />
      <RichTextToolbar />
      <VersionHistory open={historyOpen} onClose={() => setHistoryOpen(false)} pageId={page.id} save={save} />
    </DragProvider>
    </EditorActionsProvider>
    </SiteProvider>
    </CollectionsProvider>
    </ComponentsProvider>
    </IframeProvider>
  );
}
