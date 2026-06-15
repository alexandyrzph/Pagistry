// ---------------------------------------------------------------------------
// Server-side shaping of Prisma Collection rows into the JSON the client and
// renderer expect. Kept separate from cms.ts (which is pure UI logic) and
// free of client imports so it can run in route handlers and server pages.
// ---------------------------------------------------------------------------

import type { CollectionData, CollectionField, CollectionItem, CollectionMap } from "./types";

type ItemRow = { id: string; data: string; order: number };
type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  fields: string;
  detailEnabled?: boolean;
  items?: ItemRow[];
};

export function parseFields(s: string): CollectionField[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parseItemData(s: string): Record<string, any> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function serializeItem(row: ItemRow): CollectionItem {
  return { id: row.id, data: parseItemData(row.data), order: row.order };
}

export function serializeCollection(row: CollectionRow): CollectionData {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    fields: parseFields(row.fields),
    items: (row.items ?? []).map(serializeItem),
    detailEnabled: !!row.detailEnabled,
  };
}

/** Build the id -> CollectionData map consumed by BlockRenderer. */
export function buildCollectionMap(rows: CollectionRow[]): CollectionMap {
  const map: CollectionMap = {};
  for (const row of rows) map[row.id] = serializeCollection(row);
  return map;
}
