// Render tests for <TopBar/>: drives the extracted `useTopBarState` hook and the
// mode branches by rendering the exported component and interacting with it.
// Covers undo/redo disabled state, the DOM-tree / preview / autosave / save
// toggles, goHome (via the injected confirmLeave + router push), the page vs
// component-mode chrome (AI / history / export / publish / Done), the published
// menu, and the saving progress affordances.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { TopBar } from "@/components/editor/TopBar";
import { EditorActionsProvider } from "@/components/editor/editor-actions";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import type { Block } from "@/lib/types";

type Mode = "page" | "component" | "site" | "collection";

function initPage(partial: Parameters<ReturnType<typeof useEditor.getState>["init"]>[0]) {
  useEditor.getState().init(partial);
}

function block(id: string): Block {
  return { id, type: "box", props: {}, styles: {}, children: [] };
}

function renderTopBar(
  props: Partial<{
    onSave: () => void;
    onExport: () => void;
    onPublish: () => void;
    onUnpublish: () => void;
    onOpenPalette: () => void;
    onOpenHistory: () => void;
    mode: Mode;
  }> = {},
  confirmLeave: (a: () => void) => void = (a) => a(),
) {
  return render(
    <EditorActionsProvider
      value={{
        switchPage: () => {},
        confirmLeave,
        loadPageInPlace: async () => {},
        saveAsComponent: () => {},
      }}
    >
      <TopBar
        onSave={props.onSave ?? (() => {})}
        onExport={props.onExport ?? (() => {})}
        onPublish={props.onPublish ?? (() => {})}
        onUnpublish={props.onUnpublish}
        onOpenPalette={props.onOpenPalette ?? (() => {})}
        onOpenHistory={props.onOpenHistory ?? (() => {})}
        mode={props.mode}
      />
    </EditorActionsProvider>,
  );
}

beforeEach(() => {
  pushMock.mockReset();
  useEditorUI.setState({ domTree: false, autosave: false, ai: null });
  initPage({ id: "p1", title: "Home", slug: "home", published: false, tree: [] });
  useEditor.setState({ previewMode: false, saving: false, past: [], future: [] });
});

describe("TopBar — undo / redo", () => {
  it("disables undo and redo when there is no history", () => {
    renderTopBar();
    expect(screen.getByRole("button", { name: "Undo (⌘Z)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo (⌘⇧Z)" })).toBeDisabled();
  });

  it("enables undo/redo and routes the clicks to the store", () => {
    useEditor.setState({ past: [[block("a")]], future: [[block("b")]] });
    renderTopBar();

    const undoBtn = screen.getByRole("button", { name: "Undo (⌘Z)" });
    const redoBtn = screen.getByRole("button", { name: "Redo (⌘⇧Z)" });
    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).not.toBeDisabled();

    fireEvent.click(undoBtn);
    expect(useEditor.getState().future.length).toBeGreaterThan(0);
  });
});

describe("TopBar — toggles", () => {
  it("toggles the DOM tree and preview via the editor stores", () => {
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: "DOM tree" }));
    expect(useEditorUI.getState().domTree).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(useEditor.getState().previewMode).toBe(true);
  });

  it("reflects and toggles autosave, swapping the icon label", () => {
    renderTopBar();
    const off = screen.getByRole("button", { name: "Autosave off" });
    fireEvent.click(off);
    expect(useEditorUI.getState().autosave).toBe(true);
    expect(screen.getByRole("button", { name: "Autosave on" })).toBeInTheDocument();
  });

  it("invokes onSave when the save icon is clicked", () => {
    const onSave = vi.fn();
    renderTopBar({ onSave });
    fireEvent.click(screen.getByRole("button", { name: "Save (⌘S)" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe("TopBar — goHome", () => {
  it("pushes to / through confirmLeave when the brand mark is clicked", () => {
    const confirmLeave = vi.fn((a: () => void) => a());
    renderTopBar({}, confirmLeave);
    fireEvent.click(screen.getByTitle("Pagistry — all pages"));
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("does not navigate when confirmLeave swallows the action", () => {
    renderTopBar({}, () => {});
    fireEvent.click(screen.getByTitle("Pagistry — all pages"));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("TopBar — page mode chrome", () => {
  it("shows AI, history, export and the publish CTA, and opens the AI inserter", () => {
    const onOpenHistory = vi.fn();
    const onPublish = vi.fn();
    renderTopBar({ mode: "page", onOpenHistory, onPublish });

    fireEvent.click(screen.getByTitle("Generate a section with AI"));
    expect(useEditorUI.getState().ai).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Version history" }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: "Export HTML" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Publish"));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});

describe("TopBar — component mode chrome", () => {
  it.each<Mode>(["component", "site", "collection"])(
    "renders the Done button (and no export/history/AI) in %s mode",
    (mode) => {
      renderTopBar({ mode });
      expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Export HTML" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Version history" })).toBeNull();
      expect(screen.queryByTitle("Generate a section with AI")).toBeNull();
    },
  );

  it("routes the Done button through goHome", () => {
    const confirmLeave = vi.fn((a: () => void) => a());
    renderTopBar({ mode: "component" }, confirmLeave);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});

describe("TopBar — published menu", () => {
  it("opens the menu and exposes View live + Unpublish", () => {
    const onUnpublish = vi.fn();
    initPage({ id: "p1", title: "Home", slug: "home", published: true, tree: [] });
    renderTopBar({ onUnpublish });

    fireEvent.click(screen.getByText("Published"));
    const live = screen.getByRole("link", { name: /View live/ });
    expect(live).toHaveAttribute("href", "/p/home");

    fireEvent.click(screen.getByRole("button", { name: /Unpublish/ }));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });
});

describe("TopBar — saving state", () => {
  it("shows the saving skeleton/progress affordance while saving", () => {
    useEditor.setState({ saving: true });
    const { container } = renderTopBar();
    expect(screen.getByLabelText("Saving")).toBeInTheDocument();
    expect(container.querySelector(".pc-skeleton")).not.toBeNull();
  });
});
