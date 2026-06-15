// ---------------------------------------------------------------------------
// Pure helpers for the CMS module: collection / field / item shaping and the
// binding logic that maps a collection item onto a Collection List card.
// Kept framework-free so it can be unit-tested in isolation.
// ---------------------------------------------------------------------------

import type {
  CardBindings,
  CmsFieldType,
  CollectionField,
  CollectionItem,
} from "./types";

/** Human labels + defaults for each CMS field type (drives field pickers). */
export const CMS_FIELD_TYPES: { value: CmsFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "image", label: "Image" },
  { value: "url", label: "Link / URL" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
];

/** The card slots a Collection List exposes, in render order. */
export const CARD_SLOTS: { key: keyof CardBindings; label: string; hint: string }[] = [
  { key: "image", label: "Image", hint: "Card image (top)" },
  { key: "title", label: "Title", hint: "Bold heading" },
  { key: "subtitle", label: "Subtitle", hint: "Small meta line" },
  { key: "text", label: "Text", hint: "Excerpt / body" },
  { key: "link", label: "Link", hint: "Makes the card clickable" },
];

/**
 * Turn an arbitrary label into a stable, lowercase, identifier-ish key.
 * "Cover Image!" -> "cover-image". Falls back to "field" when empty.
 */
export function slugify(input: string): string {
  const s = (input ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "field";
}

/**
 * Derive a field key from a label that is unique among `existing` keys.
 * Collisions get a numeric suffix: title, title-2, title-3, …
 */
export function uniqueFieldKey(label: string, existing: string[]): string {
  const base = slugify(label);
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A blank value appropriate for a field type (used when adding items). */
export function blankValue(type: CmsFieldType): any {
  switch (type) {
    case "boolean":
      return false;
    case "number":
      return 0;
    default:
      return "";
  }
}

/** Build an empty item data object seeded with blank values per field. */
export function blankItemData(fields: CollectionField[]): Record<string, any> {
  const data: Record<string, any> = {};
  for (const f of fields) data[f.key] = blankValue(f.type);
  return data;
}

/**
 * Pick a sensible default field key for a card slot, given a collection's
 * fields — used when a Collection List is first bound so it isn't blank.
 */
export function suggestBinding(
  slot: keyof CardBindings,
  fields: CollectionField[]
): string {
  if (!fields.length) return "";
  const byType = (t: CmsFieldType) => fields.find((f) => f.type === t)?.key;
  const byName = (re: RegExp) => fields.find((f) => re.test(f.key))?.key;
  switch (slot) {
    case "image":
      return byType("image") ?? "";
    case "title":
      return byName(/title|name|heading/) ?? fields.find((f) => f.type === "text")?.key ?? fields[0].key;
    case "subtitle":
      return byName(/subtitle|category|tag|author|date/) ?? byType("date") ?? "";
    case "text":
      return byType("textarea") ?? byName(/desc|excerpt|body|summary/) ?? "";
    case "link":
      return byType("url") ?? "";
    default:
      return "";
  }
}

/** Default bindings for a freshly-bound collection. */
export function defaultBindings(fields: CollectionField[]): CardBindings {
  return {
    image: suggestBinding("image", fields),
    title: suggestBinding("title", fields),
    subtitle: suggestBinding("subtitle", fields),
    text: suggestBinding("text", fields),
    link: suggestBinding("link", fields),
  };
}

export type ResolvedCard = {
  id: string;
  image?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  link?: string;
};

/** Read a bound value off an item, returning undefined for empty bindings. */
function read(item: CollectionItem, key?: string): any {
  if (!key) return undefined;
  const v = item.data?.[key];
  return v === "" || v === null ? undefined : v;
}

/** Resolve a single item into the card slots described by `bindings`. */
export function resolveCard(item: CollectionItem, bindings: CardBindings): ResolvedCard {
  return {
    id: item.id,
    image: read(item, bindings.image),
    title: read(item, bindings.title),
    subtitle: read(item, bindings.subtitle),
    text: read(item, bindings.text),
    link: read(item, bindings.link),
  };
}

/**
 * Resolve a whole collection into ordered, limited cards ready to render.
 * `limit` of 0 (or less) means "all". Items are sorted by their `order`.
 */
export function resolveCards(
  items: CollectionItem[],
  bindings: CardBindings,
  limit = 0
): ResolvedCard[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const sliced = limit > 0 ? sorted.slice(0, limit) : sorted;
  return sliced.map((it) => resolveCard(it, bindings));
}
