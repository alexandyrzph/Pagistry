import { describe, it, expect, beforeEach } from "vitest";
import { useEditor } from "@/store/editor-store";

function reset() {
  useEditor.getState().init({
    id: "p1",
    title: "Test",
    slug: "test",
    published: false,
    tree: [],
  });
}

describe("editor store history", () => {
  beforeEach(reset);

  it("adds a block and tracks dirty", () => {
    useEditor.getState().addBlock("heading", null, 0);
    const s = useEditor.getState();
    expect(s.tree.length).toBe(1);
    expect(s.tree[0].type).toBe("heading");
    expect(s.dirty).toBe(true);
    expect(s.selectedId).toBe(s.tree[0].id);
  });

  it("undoes and redoes", () => {
    useEditor.getState().addBlock("heading", null, 0);
    useEditor.getState().addBlock("text", null, 1);
    expect(useEditor.getState().tree.length).toBe(2);

    useEditor.getState().undo();
    expect(useEditor.getState().tree.length).toBe(1);

    useEditor.getState().undo();
    expect(useEditor.getState().tree.length).toBe(0);

    useEditor.getState().redo();
    expect(useEditor.getState().tree.length).toBe(1);
  });

  it("a new action clears the redo stack", () => {
    useEditor.getState().addBlock("heading", null, 0);
    useEditor.getState().undo();
    expect(useEditor.getState().canRedo()).toBe(true);
    useEditor.getState().addBlock("text", null, 0);
    expect(useEditor.getState().canRedo()).toBe(false);
  });

  it("coalesces consecutive edits to the same prop into one history entry", () => {
    useEditor.getState().addBlock("heading", null, 0);
    const id = useEditor.getState().tree[0].id;
    const before = useEditor.getState().past.length;

    useEditor.getState().setProp(id, "text", "a");
    useEditor.getState().setProp(id, "text", "ab");
    useEditor.getState().setProp(id, "text", "abc");

    // only one new history entry for the whole typing burst
    expect(useEditor.getState().past.length).toBe(before + 1);
    expect(useEditor.getState().tree[0].props.text).toBe("abc");

    useEditor.getState().undo();
    // undo reverts the entire burst back to the default heading text
    expect(useEditor.getState().tree[0].props.text).not.toBe("abc");
  });
});
