"use client";

import { useCallback, useMemo, useState } from "react";
import { parseContent } from "@/lib/page-service";
import { parseTheme } from "@/lib/design/theme";
import { useEditor } from "@/store/editor-store";
import type { Block } from "@/lib/types";

/**
 * In-place page switching (no full reload) with an unsaved-changes guard, plus the
 * "save selection as a reusable component" flow. Returns the editor-actions context
 * object and the modal state the orchestrator renders.
 */
export function usePageNavigation(opts: { refreshComponents: () => Promise<void> }) {
  const { refreshComponents } = opts;
  const init = useEditor((s) => s.init);
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const [saveCompBlock, setSaveCompBlock] = useState<Block | null>(null);

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
    [switchPage, confirmLeave, loadPageInPlace, saveAsComponent],
  );

  return { actionsCtx, pending, setPending, saveCompBlock, setSaveCompBlock, persistComponent };
}
