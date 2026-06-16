"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDesignSystem } from "@/store/design-system";
import type { Block, CollectionData } from "@/lib/types";
import type { ComponentItem } from "./components-context";

/**
 * Loads reusable components, CMS collections, and the site header/footer, and
 * builds the provider context objects + lookup maps the editor renders with.
 */
export function useEditorData(mode: "page" | "component" | "site" | "collection") {
  const [componentList, setComponentList] = useState<ComponentItem[]>([]);
  const [collectionList, setCollectionList] = useState<CollectionData[]>([]);
  const [site, setSite] = useState<{ header: Block[]; footer: Block[] }>({ header: [], footer: [] });

  const refreshComponents = useCallback(async () => {
    try {
      const r = await fetch("/api/components");
      const d = await r.json();
      setComponentList(Array.isArray(d) ? d : []);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshCollections = useCallback(async () => {
    try {
      const r = await fetch("/api/collections");
      const d = await r.json();
      setCollectionList(Array.isArray(d) ? d : []);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshSite = useCallback(async () => {
    try {
      const r = await fetch("/api/site");
      const d = await r.json();
      setSite({ header: Array.isArray(d.header) ? d.header : [], footer: Array.isArray(d.footer) ? d.footer : [] });
    } catch {
      /* ignore */
    }
  }, []);

  const loadDesignSystem = useDesignSystem((s) => s.load);

  useEffect(() => {
    void refreshComponents();
    void refreshCollections();
    void loadDesignSystem();
    // header/footer only frame the page editor (not the component/site editors)
    if (mode === "page") void refreshSite();
  }, [refreshComponents, refreshCollections, refreshSite, loadDesignSystem, mode]);

  const componentsMap = useMemo<Record<string, ComponentItem>>(
    () => Object.fromEntries(componentList.map((c) => [c.id, c])),
    [componentList]
  );
  const componentsCtx = useMemo(
    () => ({ list: componentList, map: componentsMap, refresh: refreshComponents }),
    [componentList, componentsMap, refreshComponents]
  );

  const collectionsMap = useMemo(
    () => Object.fromEntries(collectionList.map((c) => [c.id, c])),
    [collectionList]
  );
  const collectionsCtx = useMemo(
    () => ({ list: collectionList, map: collectionsMap, refresh: refreshCollections }),
    [collectionList, collectionsMap, refreshCollections]
  );

  const siteCtx = useMemo(
    () => ({ header: site.header, footer: site.footer, refresh: refreshSite }),
    [site, refreshSite]
  );

  return { componentsCtx, collectionsCtx, siteCtx, componentsMap, collectionsMap, refreshComponents };
}
