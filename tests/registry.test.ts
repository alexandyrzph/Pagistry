import { describe, it, expect } from "vitest";
import { REGISTRY, CATEGORIES, createBlock } from "@/lib/blocks/registry";

describe("block registry integrity", () => {
  it("every entry's type matches its key and has a Render component", () => {
    for (const [key, def] of Object.entries(REGISTRY)) {
      expect(def.type).toBe(key);
      expect(typeof def.Render).toBe("function");
    }
  });

  it("every CATEGORIES type exists in REGISTRY", () => {
    for (const cat of CATEGORIES) {
      for (const t of cat.types) {
        expect(REGISTRY[t], `category "${cat.name}" lists unknown type "${t}"`).toBeDefined();
      }
    }
  });

  it("every palette block is categorized once (child-only 'column' is intentionally excluded)", () => {
    const categorized = CATEGORIES.flatMap((c) => c.types);
    expect(new Set(categorized).size).toBe(categorized.length);
    for (const type of Object.keys(REGISTRY)) {
      if (type === "column") continue;
      expect(categorized.includes(type), `"${type}" is in no category`).toBe(true);
    }
  });

  it("defaultChildren reference real registered types", () => {
    for (const def of Object.values(REGISTRY)) {
      for (const t of def.defaultChildren ?? []) {
        expect(REGISTRY[t], `defaultChildren references unknown "${t}"`).toBeDefined();
      }
    }
  });

  it("containerStrategy, when set, is a known value", () => {
    for (const def of Object.values(REGISTRY)) {
      if (def.containerStrategy !== undefined) {
        expect(["slotted", "fixed"]).toContain(def.containerStrategy);
      }
    }
  });

  it("createBlock builds a columns block with two column children", () => {
    const b = createBlock("columns");
    expect(b.type).toBe("columns");
    expect(b.children).toHaveLength(2);
    expect(b.children.every((c) => c.type === "column")).toBe(true);
    expect(b.children[0].id).not.toBe(b.children[1].id);
  });
});
