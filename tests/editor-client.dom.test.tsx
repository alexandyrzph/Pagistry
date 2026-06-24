// Render tests for <EditorClient/>: exercises the consolidated `useEditorClientState`
// hook through the rendered component — the readiness gate (skeleton → editor), the
// `init` effect seeding the real editor store, and the palette open/close wiring that
// flows from TopBar/CommandPalette through the hook's state. Heavy children and the
// dnd/data hooks are stubbed so only EditorClient + its helper are under test.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// dnd-kit's DndContext/DragOverlay touch layout APIs jsdom lacks; stub to passthrough.
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MeasuringStrategy: { WhileDragging: "while-dragging" },
  closestCenter: () => [],
  PointerSensor: function PointerSensor() {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

// Stub the heavy presentational children so the render stays light; TopBar and
// CommandPalette forward the props the hook wires so we can drive open/close.
vi.mock("@/components/BlockRenderer", () => ({
  BlockRenderer: () => <div data-testid="export" />,
}));
vi.mock("@/components/editor/CanvasOverlay", () => ({ CanvasOverlay: () => null }));
vi.mock("@/components/editor/SelectionBreadcrumb", () => ({ SelectionBreadcrumb: () => null }));
vi.mock("@/components/editor/DomTreePanel", () => ({ DomTreePanel: () => null }));
vi.mock("@/components/editor/LeftPanel", () => ({ LeftPanel: () => null }));
vi.mock("@/components/editor/Canvas", () => ({ Canvas: () => null }));
vi.mock("@/components/editor/Inspector", () => ({ FloatingInspector: () => null }));
vi.mock("@/components/editor/GhostCard", () => ({ GhostCard: () => null }));
vi.mock("@/components/editor/ContextMenu", () => ({ ContextMenu: () => null }));
vi.mock("@/components/editor/SectionInserter", () => ({ SectionInserter: () => null }));
vi.mock("@/components/editor/AiGenerateModal", () => ({ AiGenerateModal: () => null }));
vi.mock("@/components/editor/RichTextToolbar", () => ({ RichTextToolbar: () => null }));
vi.mock("@/components/editor/VersionHistory", () => ({
  VersionHistory: ({ open }: { open: boolean }) => (open ? <div data-testid="history" /> : null),
}));
vi.mock("@/components/editor/UnsavedModal", () => ({
  UnsavedModal: ({ open }: { open: boolean }) => (open ? <div data-testid="unsaved" /> : null),
}));
vi.mock("@/components/editor/SaveComponentModal", () => ({
  SaveComponentModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="savecomp" /> : null,
}));
vi.mock("@/components/editor/EditorSkeleton", () => ({
  EditorSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/editor/TopBar", () => ({
  TopBar: ({
    mode,
    onOpenPalette,
    onOpenHistory,
  }: {
    mode: string;
    onOpenPalette: () => void;
    onOpenHistory: () => void;
  }) => (
    <div data-testid="topbar" data-mode={mode}>
      <button data-testid="open-palette" onClick={onOpenPalette}>
        palette
      </button>
      <button data-testid="open-history" onClick={onOpenHistory}>
        history
      </button>
    </div>
  ),
}));
vi.mock("@/components/editor/CommandPalette", () => ({
  CommandPalette: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="palette">
        <button data-testid="close-palette" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

import { useEditor } from "@/store/editor-store";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { EditorClient, type PageDTO } from "@/components/editor/EditorClient";

function page(over: Partial<PageDTO> = {}): PageDTO {
  return { id: "p1", title: "Home", slug: "home", published: false, content: [], ...over };
}

async function renderReady(props?: Partial<Parameters<typeof EditorClient>[0]>) {
  vi.useFakeTimers();
  const utils = render(
    <DialogProvider>
      <EditorClient page={page()} {...props} />
    </DialogProvider>,
  );
  // The 550ms readiness gate keeps the skeleton up first.
  expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  vi.useRealTimers();
  await waitFor(() => expect(screen.getByTestId("topbar")).toBeInTheDocument());
  return utils;
}

beforeEach(() => {
  useEditor.setState({ pageId: null });
});

describe("EditorClient readiness gate", () => {
  it("shows the skeleton, then the editor after the readiness delay", async () => {
    await renderReady();
    expect(screen.queryByTestId("skeleton")).toBeNull();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
  });

  it("seeds the editor store from the page DTO via the init effect", async () => {
    await renderReady({ page: page({ id: "abc", title: "My Page", slug: "my-page" }) });
    const s = useEditor.getState();
    expect(s.pageId).toBe("abc");
    expect(s.title).toBe("My Page");
    expect(s.slug).toBe("my-page");
  });

  it("forwards the editor mode down to the TopBar", async () => {
    await renderReady({ mode: "component" });
    expect(screen.getByTestId("topbar").getAttribute("data-mode")).toBe("component");
  });
});

describe("EditorClient palette + history wiring", () => {
  it("opens and closes the command palette through hook state", async () => {
    await renderReady();
    expect(screen.queryByTestId("palette")).toBeNull();
    fireEvent.click(screen.getByTestId("open-palette"));
    expect(screen.getByTestId("palette")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("close-palette"));
    expect(screen.queryByTestId("palette")).toBeNull();
  });

  it("opens the version history modal through hook state", async () => {
    await renderReady();
    expect(screen.queryByTestId("history")).toBeNull();
    fireEvent.click(screen.getByTestId("open-history"));
    expect(screen.getByTestId("history")).toBeInTheDocument();
  });
});
