import { describe, it, expect } from "vitest";
import { extractJsonArray, sanitizeGeneratedBlocks } from "@/lib/ai";

describe("extractJsonArray", () => {
  it("parses a plain array", () => {
    expect(extractJsonArray('[{"type":"hero"}]')).toEqual([{ type: "hero" }]);
  });
  it("strips ```json fences", () => {
    expect(extractJsonArray('```json\n[{"type":"text"}]\n```')).toEqual([{ type: "text" }]);
  });
  it("extracts the array from surrounding prose", () => {
    expect(extractJsonArray('Sure!\n[{"type":"cta"}]\nHope that helps')).toEqual([{ type: "cta" }]);
  });
  it("returns null on non-JSON", () => {
    expect(extractJsonArray("no json here")).toBeNull();
    expect(extractJsonArray("")).toBeNull();
  });
});

describe("sanitizeGeneratedBlocks", () => {
  it("builds valid blocks with fresh ids and only known props", () => {
    const out = sanitizeGeneratedBlocks([
      { type: "heading", props: { text: "Hi", level: "h1", bogus: "x" } },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("heading");
    expect(out[0].props.text).toBe("Hi");
    expect(out[0].props.level).toBe("h1");
    expect(out[0].props.bogus).toBeUndefined();
    expect(typeof out[0].id).toBe("string");
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it("drops unknown / unsafe block types", () => {
    expect(sanitizeGeneratedBlocks([{ type: "evil" }, { type: "component" }, { type: "hero" }])).toHaveLength(1);
  });

  it("returns [] for non-array input", () => {
    expect(sanitizeGeneratedBlocks("x")).toEqual([]);
    expect(sanitizeGeneratedBlocks(null)).toEqual([]);
    expect(sanitizeGeneratedBlocks({})).toEqual([]);
  });

  it("sanitizes children only for container blocks", () => {
    const out = sanitizeGeneratedBlocks([
      { type: "section", children: [{ type: "heading", props: { text: "H" } }, { type: "evil" }] },
    ]);
    expect(out[0].type).toBe("section");
    expect(out[0].children.map((c) => c.type)).toEqual(["heading"]);
  });

  it("keeps array props like feature items", () => {
    const out = sanitizeGeneratedBlocks([
      { type: "features", props: { items: [{ icon: "Zap", title: "Fast", text: "x" }] } },
    ]);
    expect(Array.isArray(out[0].props.items)).toBe(true);
    expect(out[0].props.items[0].title).toBe("Fast");
  });
});
