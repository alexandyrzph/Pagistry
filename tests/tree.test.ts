import { describe, it, expect } from "vitest";
import {
  canDrop,
  duplicateBlock,
  findBlockById,
  getDescendantIds,
  insertBlock,
  locate,
  moveBlock,
  pathToBlock,
  removeBlock,
  setBlockStyles,
  updateBlockProp,
  updateBlockStyle,
} from "@/lib/blocks/tree";
import type { Block } from "@/lib/types";

const node = (id: string, type = "text", children: Block[] = []): Block => ({
  id,
  type,
  props: { text: id },
  styles: {},
  children,
});

function sampleTree(): Block[] {
  return [
    node("s1", "section", [node("a"), node("b")]),
    node("s2", "section", [node("c")]),
  ];
}

describe("findBlockById / locate", () => {
  it("finds nested blocks", () => {
    const t = sampleTree();
    expect(findBlockById(t, "b")?.id).toBe("b");
    expect(findBlockById(t, "missing")).toBeNull();
  });

  it("locates parent and index", () => {
    const t = sampleTree();
    expect(locate(t, "s1")).toEqual({ parentId: null, index: 0 });
    expect(locate(t, "b")).toEqual({ parentId: "s1", index: 1 });
    expect(locate(t, "c")).toEqual({ parentId: "s2", index: 0 });
  });
});

describe("insertBlock", () => {
  it("inserts at root index", () => {
    const t = insertBlock(sampleTree(), node("x"), null, 1);
    expect(t.map((b) => b.id)).toEqual(["s1", "x", "s2"]);
  });

  it("inserts into a nested parent", () => {
    const t = insertBlock(sampleTree(), node("x"), "s1", 1);
    expect(findBlockById(t, "s1")!.children.map((c) => c.id)).toEqual(["a", "x", "b"]);
  });

  it("clamps out-of-range indexes", () => {
    const t = insertBlock(sampleTree(), node("x"), null, 99);
    expect(t.map((b) => b.id)).toEqual(["s1", "s2", "x"]);
  });
});

describe("removeBlock", () => {
  it("removes and returns the block", () => {
    const { tree, removed } = removeBlock(sampleTree(), "a");
    expect(removed?.id).toBe("a");
    expect(findBlockById(tree, "a")).toBeNull();
    expect(findBlockById(tree, "s1")!.children.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("moveBlock", () => {
  it("reorders within the same parent", () => {
    const t = moveBlock(sampleTree(), "a", "s1", 2); // a after b
    expect(findBlockById(t, "s1")!.children.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("moves across parents", () => {
    const t = moveBlock(sampleTree(), "a", "s2", 0);
    expect(findBlockById(t, "s1")!.children.map((c) => c.id)).toEqual(["b"]);
    expect(findBlockById(t, "s2")!.children.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("refuses to move a block into its own descendant", () => {
    const t = sampleTree();
    const moved = moveBlock(t, "s1", "a", 0);
    // unchanged
    expect(moved).toEqual(t);
  });
});

describe("duplicateBlock", () => {
  it("inserts a deep clone with fresh ids right after the original", () => {
    const t = duplicateBlock(sampleTree(), "s1");
    expect(t.length).toBe(3);
    expect(t[1].id).not.toBe("s1");
    expect(t[1].type).toBe("section");
    // children also get new ids
    const origChildIds = t[0].children.map((c) => c.id);
    const cloneChildIds = t[1].children.map((c) => c.id);
    expect(cloneChildIds).not.toEqual(origChildIds);
    expect(cloneChildIds.length).toBe(2);
  });
});

describe("updateBlockProp", () => {
  it("sets a top-level prop", () => {
    const t = updateBlockProp(sampleTree(), "a", "text", "hello");
    expect(findBlockById(t, "a")!.props.text).toBe("hello");
  });

  it("sets a dotted array path", () => {
    const start = [{ id: "l", type: "list", props: { items: ["one", "two"] }, styles: {}, children: [] }] as Block[];
    const t = updateBlockProp(start, "l", "items.1", "TWO");
    expect(findBlockById(t, "l")!.props.items).toEqual(["one", "TWO"]);
  });
});

describe("updateBlockStyle", () => {
  it("sets and clears style values per viewport", () => {
    let t = updateBlockStyle(sampleTree(), "a", "desktop", "color", "#fff");
    expect(findBlockById(t, "a")!.styles.desktop?.color).toBe("#fff");
    t = updateBlockStyle(t, "a", "desktop", "color", "");
    expect(findBlockById(t, "a")!.styles.desktop?.color).toBeUndefined();
  });
});

describe("getDescendantIds", () => {
  it("collects all nested ids", () => {
    const t = sampleTree();
    expect(getDescendantIds(t[0]).sort()).toEqual(["a", "b"]);
  });
});

describe("pathToBlock", () => {
  it("returns the ancestor chain including the block", () => {
    const t = sampleTree();
    expect(pathToBlock(t, "b")!.map((n) => n.id)).toEqual(["s1", "b"]);
    expect(pathToBlock(t, "s2")!.map((n) => n.id)).toEqual(["s2"]);
    expect(pathToBlock(t, "missing")).toBeNull();
  });
});

describe("setBlockStyles", () => {
  it("replaces the whole responsive style set with a deep copy", () => {
    const src = { desktop: { color: "#fff" }, mobile: { fontSize: "12px" } };
    const t = setBlockStyles(sampleTree(), "a", src);
    expect(findBlockById(t, "a")!.styles).toEqual(src);
    // mutating the source must not leak into the tree (deep copy)
    src.desktop.color = "#000";
    expect(findBlockById(t, "a")!.styles.desktop?.color).toBe("#fff");
  });
});

describe("canDrop", () => {
  it("enforces container rules", () => {
    expect(canDrop(null, "section")).toBe(true);
    expect(canDrop("section", "heading")).toBe(true);
    expect(canDrop("section", "column")).toBe(false);
    expect(canDrop("columns", "column")).toBe(true);
    expect(canDrop("columns", "heading")).toBe(false);
    expect(canDrop("column", "heading")).toBe(true);
    expect(canDrop("column", "section")).toBe(false);
    expect(canDrop("heading", "text")).toBe(false); // leaf
  });
});
