"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { responsiveCss } from "@/lib/blocks/styles";
import { designSystemCss } from "@/lib/design/design-system";
import { themeVars } from "@/lib/design/theme";
import type { Block, Theme } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { useDesignSystem } from "@/store/design-system";
import { useCanvasZoom } from "@/store/canvas-zoom";
import { useIframe } from "./iframe-context";

// ---------------------------------------------------------------------------
// Hosts the page in a real <iframe> so Tailwind's responsive utilities and the
// authored @media overrides resolve against the *device* width. The React tree
// is portaled into the iframe body (keeping all React context — DndContext,
// zustand, providers). Because React doesn't delegate native events into a
// cross-document portal, selection/hover are wired with delegated listeners on
// the iframe document, and inline editing uses native listeners (see Editable).
// ---------------------------------------------------------------------------

function copyStyles(doc: Document) {
  document
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach((n) => doc.head.appendChild(n.cloneNode(true)));

  const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] })
    .adoptedStyleSheets;
  if (adopted) {
    for (const sheet of adopted) {
      try {
        const text = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        if (text) {
          const el = doc.createElement("style");
          el.textContent = text;
          doc.head.appendChild(el);
        }
      } catch {
        /* inaccessible sheet — skip */
      }
    }
  }
}

export function CanvasFrame({
  tree,
  theme,
  editable,
  cssExtra,
  children,
}: {
  tree: Block[];
  theme: Theme;
  editable: boolean;
  /** extra block trees (e.g. site header/footer) whose styles to include */
  cssExtra?: Block[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const dynRef = useRef<HTMLStyleElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const { register, bump } = useIframe();
  const colors = useDesignSystem((s) => s.colors);
  const textStyles = useDesignSystem((s) => s.textStyles);

  const handleLoad = () => {
    const el = ref.current;
    const doc = el?.contentDocument;
    if (!el || !doc) return;
    copyStyles(doc);
    const dyn = doc.createElement("style");
    dyn.setAttribute("data-pc-frame", "");
    doc.head.appendChild(dyn);
    dynRef.current = dyn;
    doc.documentElement.style.height = "100%";
    doc.documentElement.style.overscrollBehavior = "none";
    doc.body.style.margin = "0";
    doc.body.style.minHeight = "100%";
    doc.body.style.overscrollBehavior = "none";
    setBody(doc.body);
    register({ el, doc, body: doc.body });

    const win = el.contentWindow;
    // NOTE: scroll is intentionally NOT bumped here. The overlay/inspector sync
    // to scroll themselves (the overlay via a rAF loop for frame-perfect tracking,
    // the inspector via its own scroll listeners); bumping on scroll would force a
    // re-render every frame and reset the overlay's baseline, defeating the rAF.
    if (win) win.addEventListener("resize", () => bump());
    // Re-measure overlays when the content relayouts (image loads, dynamic height).
    roRef.current?.disconnect();
    roRef.current = new ResizeObserver(() => bump());
    roRef.current.observe(doc.body);
  };

  // Delegated selection + hover (events don't cross the portal, so listen here).
  useEffect(() => {
    if (!editable || !body) return;
    const doc = body.ownerDocument;
    const idOf = (t: EventTarget | null) =>
      (t as HTMLElement)?.closest?.("[data-block-id]")?.getAttribute("data-block-id") ?? null;
    // Select on pointerdown (click events don't reliably fire through the
    // cross-document portal); hover via mouseover.
    const onDown = (e: Event) => {
      const t = e.target as HTMLElement;
      // "generate with AI" trigger in the empty-state placeholder
      if (t?.closest?.("[data-open-ai]")) {
        e.preventDefault();
        useEditorUI.getState().openAi();
        return;
      }
      // "add section" inserter triggers in the placeholder / canvas
      const insBtn = t?.closest?.("[data-open-inserter]") as HTMLElement | null;
      if (insBtn) {
        e.preventDefault();
        const parent = insBtn.getAttribute("data-open-inserter");
        const idx = insBtn.getAttribute("data-insert-index");
        useEditorUI.getState().openInserter({
          parentId: parent && parent !== "root" ? parent : null,
          index: idx != null ? Number(idx) : -1,
        });
        return;
      }
      // quick-add buttons in the empty-state placeholder
      const addBtn = t?.closest?.("[data-add-block]") as HTMLElement | null;
      if (addBtn) {
        e.preventDefault();
        const type = addBtn.getAttribute("data-add-block")!;
        const parent = addBtn.getAttribute("data-add-parent");
        useEditor.getState().addBlock(type, parent && parent !== "root" ? parent : null, 0);
        return;
      }
      const id = idOf(e.target);
      const pe = e as PointerEvent;
      // shift / cmd / ctrl click toggles a block in the multi-selection
      if (id && (pe.shiftKey || pe.metaKey || pe.ctrlKey)) {
        useEditor.getState().toggleSelect(id);
        return;
      }
      useEditor.getState().select(id);
    };
    const onOver = (e: Event) => useEditor.getState().hover(idOf(e.target));
    const onLeave = () => useEditor.getState().hover(null);
    const onCtx = (e: MouseEvent) => {
      const id = idOf(e.target);
      if (!id) return;
      e.preventDefault();
      useEditor.getState().select(id);
      const frameEl = doc.defaultView?.frameElement as HTMLElement | null;
      const r = frameEl?.getBoundingClientRect();
      // clientX/Y are in the iframe's unscaled coords; scale to the visual frame.
      const z = useCanvasZoom.getState().zoom;
      useEditorUI.getState().openCtx(e.clientX * z + (r?.left ?? 0), e.clientY * z + (r?.top ?? 0), id);
    };
    doc.addEventListener("pointerdown", onDown);
    doc.addEventListener("mouseover", onOver);
    doc.documentElement.addEventListener("mouseleave", onLeave);
    doc.addEventListener("contextmenu", onCtx);
    return () => {
      doc.removeEventListener("pointerdown", onDown);
      doc.removeEventListener("mouseover", onOver);
      doc.documentElement.removeEventListener("mouseleave", onLeave);
      doc.removeEventListener("contextmenu", onCtx);
    };
  }, [editable, body]);

  // Keep the responsive stylesheet + theme tokens in sync; re-measure overlays.
  // (No reset CSS here — the copied Tailwind preflight provides it, properly
  // layered; an unlayered reset would override Tailwind utilities like text-*.)
  useEffect(() => {
    if (dynRef.current) {
      dynRef.current.textContent =
        designSystemCss(colors, textStyles) +
        "\n" +
        responsiveCss([...tree, ...(cssExtra ?? [])], { editable });
    }
    bump();
  }, [tree, cssExtra, body, bump, editable, colors, textStyles]);

  useEffect(() => {
    if (!body) return;
    const vars = themeVars(theme) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) body.style.setProperty(k, v);
  }, [body, theme]);

  useEffect(() => () => {
    roRef.current?.disconnect();
    register(null);
  }, [register]);

  return (
    <>
      <iframe
        ref={ref}
        title="Canvas"
        srcDoc="<!doctype html><html><head></head><body></body></html>"
        onLoad={handleLoad}
        className="block h-full w-full border-0 bg-white"
      />
      {body && createPortal(children, body)}
    </>
  );
}
