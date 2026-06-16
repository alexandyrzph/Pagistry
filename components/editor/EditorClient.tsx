"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createBlock, createComponentInstance } from "@/lib/registry";
import { findBlockById, getDescendantIds } from "@/lib/tree";
import { parseContent } from "@/lib/page-service";
import { parseTheme } from "@/lib/theme";
import type { Block, Seo, Theme } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { BlockRenderer } from "@/components/BlockRenderer";
import { DragProvider, type DragInfo } from "./drag-context";
import { ComponentsProvider } from "./components-context";
import { CollectionsProvider } from "./collections-context";
import { SiteProvider } from "./site-context";
import { EditorActionsProvider } from "./editor-actions";
import { useEditorData } from "./use-editor-data";
import { useEditorPersistence } from "./use-editor-persistence";
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

const EMPTY: DragInfo = { type: null, id: null, invalid: new Set(), ghost: null };

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
  const addBlock = useEditor((s) => s.addBlock);
  const addComponentInstance = useEditor((s) => s.addComponentInstance);
  const moveExisting = useEditor((s) => s.moveExisting);

  const [drag, setDrag] = useState<DragInfo>(EMPTY);
  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<{ run: () => void } | null>(null);

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

  // Translate a node's rect to top-document coords. Nodes inside the canvas
  // iframe are offset by the iframe's (scaled) position AND scaled by the canvas
  // zoom — their internal getBoundingClientRect is in unscaled iframe pixels,
  // so it must be multiplied by zoom to match the visually scaled iframe.
  const measure = useCallback((node: HTMLElement) => {
    const r = node.getBoundingClientRect();
    const fr = frameRef.current;
    if (fr && node.ownerDocument === fr.doc) {
      const z = useCanvasZoom.getState().zoom;
      const fb = fr.el.getBoundingClientRect();
      const left = fb.left + r.left * z;
      const top = fb.top + r.top * z;
      const width = r.width * z;
      const height = r.height * z;
      return { width, height, top, left, right: left + width, bottom: top + height };
    }
    return { width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }, []);
  const [saveCompBlock, setSaveCompBlock] = useState<Block | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // --- persistence ----------------------------------------------------------
  const { save, publish, unpublish, exportHtml, exportRef } = useEditorPersistence({
    isSiteMode,
    isCollectionMode,
    isComponentMode,
    siteRegion,
  });

  // --- in-place page switching (no full reload / skeleton) ------------------
  const loadPageInPlace = useCallback(
    async (id: string) => {
      try {
        const r = await fetch(`/api/pages/${id}`);
        if (!r.ok) return;
        const p = await r.json();
        init({
          id: p.id,
          title: p.title,
          slug: p.slug,
          published: !!p.published,
          tree: parseContent(p.content),
          seo: {
            metaTitle: p.metaTitle ?? "",
            metaDescription: p.metaDescription ?? "",
            ogImage: p.ogImage ?? "",
          },
          theme: parseTheme(p.theme),
        });
        window.history.replaceState(null, "", `/editor/${id}`);
        window.scrollTo({ top: 0 });
      } catch {
        /* ignore */
      }
    },
    [init]
  );

  const confirmLeave = useCallback((action: () => void) => {
    if (useEditor.getState().dirty) setPending({ run: action });
    else action();
  }, []);

  const switchPage = useCallback(
    (id: string) => {
      if (id === useEditor.getState().pageId) return;
      confirmLeave(() => void loadPageInPlace(id));
    },
    [confirmLeave, loadPageInPlace]
  );

  const saveAsComponent = useCallback((block: Block) => setSaveCompBlock(block), []);

  const persistComponent = useCallback(
    async (name: string) => {
      const block = saveCompBlock;
      if (!block) return;
      try {
        const res = await fetch("/api/components", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, content: [block] }),
        });
        const created = await res.json();
        await refreshComponents();
        useEditor.getState().replaceWithComponent(block.id, created.id);
      } catch {
        /* ignore */
      } finally {
        setSaveCompBlock(null);
      }
    },
    [saveCompBlock, refreshComponents]
  );

  const actionsCtx = useMemo(
    () => ({ switchPage, confirmLeave, loadPageInPlace, saveAsComponent }),
    [switchPage, confirmLeave, loadPageInPlace, saveAsComponent]
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editing =
        !!el &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT");
      const mod = e.metaKey || e.ctrlKey;
      const st = useEditor.getState();

      if (e.key === "Escape") {
        // blur any active field first, then close the settings panel
        (el as HTMLElement | null)?.blur?.();
        if (st.selectedId) {
          e.preventDefault();
          st.select(null);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      // canvas zoom — ⌘+ / ⌘- / ⌘0 (works while focused anywhere)
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        useCanvasZoom.getState().zoomIn();
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        useCanvasZoom.getState().zoomOut();
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        useCanvasZoom.getState().reset();
        return;
      }
      if (editing) return;
      // ⌘⌥C / ⌘⌥V — copy & paste styles (use e.code; Alt mangles e.key on Mac)
      if (mod && e.altKey && e.code === "KeyC" && st.selectedId) {
        e.preventDefault();
        st.copyStyles(st.selectedId);
        return;
      }
      if (mod && e.altKey && e.code === "KeyV" && (st.selectedId || st.selectedIds.length)) {
        e.preventDefault();
        st.pasteStyles(st.selectedId ?? st.selectedIds[0]);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && (st.selectedId || st.selectedIds.length)) {
        e.preventDefault();
        st.removeSelected();
      }
      if (mod && e.key.toLowerCase() === "d" && (st.selectedId || st.selectedIds.length)) {
        e.preventDefault();
        st.duplicateSelected();
      }
      if (mod && !e.altKey && e.key.toLowerCase() === "c" && st.selectedId) {
        e.preventDefault();
        st.copy(st.selectedId);
      }
      if (mod && e.key.toLowerCase() === "x" && st.selectedId) {
        e.preventDefault();
        st.cut(st.selectedId);
      }
      if (mod && !e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        st.paste(st.selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    // also listen inside the canvas iframe (focus may live there)
    const fw = frame?.el.contentWindow;
    fw?.addEventListener("keydown", onKey as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      fw?.removeEventListener("keydown", onKey as EventListener);
    };
  }, [save, frame]);

  // --- drag and drop --------------------------------------------------------
  // While dragging, make the iframe transparent to pointer events so the
  // top-document sensor keeps receiving pointermove over the canvas.
  const setFramePassthrough = (on: boolean) => {
    const el = frameRef.current?.el;
    if (!el) return;
    if (on) el.style.setProperty("pointer-events", "none");
    else el.style.removeProperty("pointer-events");
  };

  // Custom auto-scroll for the canvas iframe (dnd-kit only scrolls the top
  // document, not the iframe's own scroll context).
  const dragPointerY = useRef(0);
  const autoScrollRaf = useRef(0);
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    dragPointerY.current = e.clientY;
  }, []);
  const startAutoScroll = useCallback(() => {
    const EDGE = 80;
    const MAX = 20;
    const tick = () => {
      const fr = frameRef.current;
      const win = fr?.el.contentWindow;
      if (fr && win) {
        const r = fr.el.getBoundingClientRect();
        const y = dragPointerY.current;
        let dy = 0;
        if (y < r.top + EDGE) dy = -MAX * Math.min(1, (r.top + EDGE - y) / EDGE);
        else if (y > r.bottom - EDGE) dy = MAX * Math.min(1, (y - (r.bottom - EDGE)) / EDGE);
        if (dy) win.scrollBy(0, dy);
      }
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(autoScrollRaf.current);
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, []);
  const stopAutoScroll = useCallback(() => {
    cancelAnimationFrame(autoScrollRaf.current);
    window.removeEventListener("pointermove", onWindowPointerMove);
  }, [onWindowPointerMove]);

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (!data) return;
    setFramePassthrough(true);
    window.addEventListener("pointermove", onWindowPointerMove);
    startAutoScroll();
    if (data.kind === "new") {
      const ghost = data.componentId
        ? createComponentInstance(data.componentId)
        : createBlock(data.blockType);
      setDrag({
        type: data.blockType,
        id: null,
        invalid: new Set(),
        ghost,
      });
    } else {
      const block = findBlockById(useEditor.getState().tree, data.blockId);
      const invalid = new Set<string>([data.blockId]);
      if (block) getDescendantIds(block).forEach((id) => invalid.add(id));
      setDrag({ type: data.blockType, id: data.blockId, invalid, ghost: block });
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDrag(EMPTY);
    setFramePassthrough(false);
    stopAutoScroll();
    const over = e.over;
    const a = e.active.data.current as any;
    if (!over || !a) return;
    const d = over.data.current as { parentId: string | null; index: number };
    if (!d) return;
    if (a.kind === "new") {
      if (a.componentId) addComponentInstance(a.componentId, d.parentId, d.index);
      else addBlock(a.blockType, d.parentId, d.index);
    } else {
      moveExisting(a.blockId, d.parentId, d.index);
    }
  };

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
        onDragCancel={() => {
          setDrag(EMPTY);
          setFramePassthrough(false);
          stopAutoScroll();
        }}
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
