import { describe, it, expect } from "vitest";
import {
  slugify,
  uniqueFieldKey,
  blankItemData,
  blankValue,
  suggestBinding,
  defaultBindings,
  resolveCard,
  resolveCards,
} from "@/lib/cms";
import type { CollectionField, CollectionItem } from "@/lib/types";

const FIELDS: CollectionField[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "cover", label: "Cover", type: "image" },
  { key: "excerpt", label: "Excerpt", type: "textarea" },
  { key: "link", label: "Link", type: "url" },
  { key: "published", label: "Published", type: "date" },
];

describe("slugify", () => {
  it("lowercases and dasherizes", () => {
    expect(slugify("Cover Image!")).toBe("cover-image");
    expect(slugify("  Hello   World  ")).toBe("hello-world");
    expect(slugify("Already-good")).toBe("already-good");
  });

  it("falls back to 'field' when empty", () => {
    expect(slugify("")).toBe("field");
    expect(slugify("   ")).toBe("field");
    expect(slugify("!!!")).toBe("field");
  });
});

describe("uniqueFieldKey", () => {
  it("returns the base key when free", () => {
    expect(uniqueFieldKey("Title", [])).toBe("title");
  });

  it("suffixes on collision", () => {
    expect(uniqueFieldKey("Title", ["title"])).toBe("title-2");
    expect(uniqueFieldKey("Title", ["title", "title-2"])).toBe("title-3");
  });
});

describe("blank values", () => {
  it("uses type-appropriate blanks", () => {
    expect(blankValue("boolean")).toBe(false);
    expect(blankValue("number")).toBe(0);
    expect(blankValue("text")).toBe("");
  });

  it("seeds an item data object from fields", () => {
    expect(blankItemData(FIELDS)).toEqual({
      title: "",
      cover: "",
      excerpt: "",
      link: "",
      published: "",
    });
  });
});

describe("binding suggestions", () => {
  it("matches slots to plausible fields", () => {
    expect(suggestBinding("image", FIELDS)).toBe("cover");
    expect(suggestBinding("title", FIELDS)).toBe("title");
    expect(suggestBinding("text", FIELDS)).toBe("excerpt");
    expect(suggestBinding("link", FIELDS)).toBe("link");
    expect(suggestBinding("subtitle", FIELDS)).toBe("published"); // date fallback
  });

  it("defaults every slot from a field set", () => {
    const b = defaultBindings(FIELDS);
    expect(b.image).toBe("cover");
    expect(b.title).toBe("title");
  });

  it("returns empty bindings for an empty schema", () => {
    expect(defaultBindings([])).toEqual({
      image: "",
      title: "",
      subtitle: "",
      text: "",
      link: "",
    });
  });
});

describe("resolveCard", () => {
  const item: CollectionItem = {
    id: "i1",
    order: 0,
    data: { title: "Hello", cover: "/a.jpg", excerpt: "", link: "/post" },
  };

  it("maps bound fields and drops empty values", () => {
    const card = resolveCard(item, { title: "title", image: "cover", text: "excerpt", link: "link" });
    expect(card).toEqual({
      id: "i1",
      title: "Hello",
      image: "/a.jpg",
      subtitle: undefined,
      text: undefined, // excerpt is "" -> dropped
      link: "/post",
    });
  });

  it("ignores unbound slots", () => {
    const card = resolveCard(item, { title: "title" });
    expect(card.title).toBe("Hello");
    expect(card.image).toBeUndefined();
  });
});

describe("resolveCards", () => {
  const items: CollectionItem[] = [
    { id: "b", order: 2, data: { title: "B" } },
    { id: "a", order: 1, data: { title: "A" } },
    { id: "c", order: 3, data: { title: "C" } },
  ];

  it("sorts by order", () => {
    const cards = resolveCards(items, { title: "title" });
    expect(cards.map((c) => c.title)).toEqual(["A", "B", "C"]);
  });

  it("applies a positive limit", () => {
    const cards = resolveCards(items, { title: "title" }, 2);
    expect(cards.map((c) => c.title)).toEqual(["A", "B"]);
  });

  it("treats limit <= 0 as all", () => {
    expect(resolveCards(items, { title: "title" }, 0)).toHaveLength(3);
  });
});
