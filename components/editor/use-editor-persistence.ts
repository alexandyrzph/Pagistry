"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildExportDocument } from "@/lib/blocks/export-html";
import { designSystemCss } from "@/lib/design/design-system";
import { useEditor } from "@/store/editor-store";
import { useDesignSystem } from "@/store/design-system";

/**
 * Save/publish/unpublish/export for whichever editor mode is active, plus the
 * debounced autosave and the unsaved-changes unload warning. Owns the hidden
 * export node's ref (attach the returned `exportRef` to the export <div>).
 */
export function useEditorPersistence(opts: {
  isSiteMode: boolean;
  isCollectionMode: boolean;
  isComponentMode: boolean;
  siteRegion?: "header" | "footer";
}) {
  const { isSiteMode, isCollectionMode, isComponentMode, siteRegion } = opts;
  const exportRef = useRef<HTMLDivElement>(null);
  const dirty = useEditor((s) => s.dirty);
  const tree = useEditor((s) => s.tree);

  const save = useCallback(async () => {
    const s = useEditor.getState();
    if (!s.pageId) return;
    s.setSaving(true);
    const started = Date.now();
    try {
      const url = isSiteMode
        ? `/api/site`
        : isCollectionMode
          ? `/api/collections/${s.pageId}`
          : isComponentMode
            ? `/api/components/${s.pageId}`
            : `/api/pages/${s.pageId}`;
      const payload = isSiteMode
        ? { [siteRegion ?? "header"]: s.tree }
        : isCollectionMode
          ? { detailTemplate: s.tree }
          : isComponentMode
            ? { name: s.title, content: s.tree }
            : { title: s.title, content: s.tree, seo: s.seo, theme: s.theme };
      await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      // keep the saving indicator visible long enough to read
      const elapsed = Date.now() - started;
      if (elapsed < 650) await new Promise((r) => setTimeout(r, 650 - elapsed));
      useEditor.getState().markSaved(Date.now());
    } catch {
      useEditor.getState().setSaving(false);
    }
  }, [isComponentMode, isSiteMode, isCollectionMode, siteRegion]);

  const publish = useCallback(async () => {
    await save();
    const s = useEditor.getState();
    if (!s.pageId) return;
    try {
      const res = await fetch(`/api/pages/${s.pageId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      const data = await res.json();
      useEditor.getState().setPublished(!!data.published);
      // capture a restore point for each publish
      void fetch(`/api/pages/${s.pageId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Published" }),
      });
    } catch {
      /* ignore */
    }
  }, [save]);

  const unpublish = useCallback(async () => {
    const s = useEditor.getState();
    if (!s.pageId) return;
    try {
      const res = await fetch(`/api/pages/${s.pageId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      const data = await res.json();
      useEditor.getState().setPublished(!!data.published);
    } catch {
      /* ignore */
    }
  }, []);

  const exportHtml = useCallback(() => {
    const s = useEditor.getState();
    const body = exportRef.current?.innerHTML ?? "";
    const ds = useDesignSystem.getState();
    const html = buildExportDocument(s.title, body, s.tree, designSystemCss(ds.colors, ds.textStyles));
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.slug || "page"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  // warn on hard unload (refresh / close) with unsaved edits
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, tree, save]);

  return { save, publish, unpublish, exportHtml, exportRef };
}
