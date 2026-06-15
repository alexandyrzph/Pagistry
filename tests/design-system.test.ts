import { describe, it, expect } from "vitest";
import { designSystemCss, parseDesignSystem } from "@/lib/design-system";

describe("designSystemCss", () => {
  it("emits color tokens as CSS variables on body", () => {
    const css = designSystemCss([{ id: "abc", name: "Brand", value: "#6366f1" }], []);
    expect(css).toContain("body { --pc-color-abc: #6366f1; }");
  });

  it("emits text styles as single-class rules", () => {
    const css = designSystemCss([], [
      { id: "h1", name: "Display", props: { fontSize: "48px", fontWeight: "700" } },
    ]);
    expect(css).toContain(".ts-h1 {");
    expect(css).toContain("font-size: 48px;");
    expect(css).toContain("font-weight: 700;");
  });

  it("skips empty tokens and styles", () => {
    expect(designSystemCss([], [])).toBe("");
    expect(designSystemCss([{ id: "x", name: "", value: "" }], [{ id: "y", name: "", props: {} }])).toBe("");
  });
});

describe("parseDesignSystem", () => {
  it("parses stored JSON arrays", () => {
    const ds = parseDesignSystem({
      colors: JSON.stringify([{ id: "a", name: "A", value: "#fff" }]),
      textStyles: JSON.stringify([{ id: "b", name: "B", props: {} }]),
    });
    expect(ds.colors).toHaveLength(1);
    expect(ds.textStyles[0].name).toBe("B");
  });

  it("is resilient to null/garbage", () => {
    expect(parseDesignSystem(null)).toEqual({ colors: [], textStyles: [] });
    expect(parseDesignSystem({ colors: "not json", textStyles: undefined })).toEqual({ colors: [], textStyles: [] });
  });
});
