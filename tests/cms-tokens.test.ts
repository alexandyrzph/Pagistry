import { describe, it, expect } from "vitest";
import { applyTokens } from "@/lib/cms-tokens";
import type { Block } from "@/lib/types";

const mk = (props: Record<string, any>, children: Block[] = []): Block => ({
  id: "x",
  type: "heading",
  props,
  styles: {},
  children,
});

describe("applyTokens", () => {
  it("fills tokens in string props", () => {
    const out = applyTokens([mk({ text: "{{title}}" })], { title: "Hello" });
    expect(out[0].props.text).toBe("Hello");
  });

  it("handles surrounding text + whitespace tokens", () => {
    const out = applyTokens([mk({ text: "Read: {{ title }} now" })], { title: "Docs" });
    expect(out[0].props.text).toBe("Read: Docs now");
  });

  it("fills nested objects/arrays; missing keys become empty", () => {
    const out = applyTokens([mk({ items: [{ title: "{{name}}", text: "by {{author}}" }] })], { name: "Pro" });
    expect(out[0].props.items[0].title).toBe("Pro");
    expect(out[0].props.items[0].text).toBe("by ");
  });

  it("recurses into children", () => {
    const tree = [mk({}, [mk({ text: "{{title}}" })])];
    const out = applyTokens(tree, { title: "X" });
    expect(out[0].children[0].props.text).toBe("X");
  });

  it("does not mutate the input tree", () => {
    const tree = [mk({ text: "{{title}}" })];
    applyTokens(tree, { title: "Y" });
    expect(tree[0].props.text).toBe("{{title}}");
  });
});
