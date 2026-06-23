// Render tests for <Dashboard/>: drives the extracted state hook and the thin
// render by mounting the component and interacting with it. Covers the
// readiness gate, the AI button gate, the ?new=1 deep-link, search filtering,
// the empty state, template creation, and delete.
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const { pushMock, replaceMock, refreshMock, confirmMock, getParam } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  confirmMock: vi.fn(),
  getParam: {
    current: (key: string): string | null => {
      void key;
      return null;
    },
  },
}));

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: refreshMock }),
  useSearchParams: () => ({ get: (k: string) => getParam.current(k) }),
}));
vi.mock("@/components/ui/dialog-provider", () => ({ useConfirm: () => confirmMock }));

import { api } from "@/lib/api/client";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { DashboardPage } from "@/components/dashboard/PageCard";

const get = api.get as unknown as Mock;
const post = api.post as unknown as Mock;
const del = api.delete as unknown as Mock;

function page(over: Partial<DashboardPage> = {}): DashboardPage {
  return {
    id: "p1",
    title: "Portfolio",
    slug: "portfolio",
    published: true,
    updatedAt: new Date("2026-06-16T12:00:00Z").toISOString(),
    submissions: 0,
    thumbnailUrl: null,
    thumbnailVersion: null,
    ...over,
  };
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  refreshMock.mockReset();
  confirmMock.mockReset().mockResolvedValue(true);
  get.mockReset().mockResolvedValue({ data: { providers: [] } });
  post.mockReset();
  del.mockReset();
  getParam.current = () => null;
});

// Mount and wait out the 500ms readiness gate so the real content renders.
async function mountReady(pages: DashboardPage[]) {
  const ui = render(<Dashboard pages={pages} />);
  await screen.findByText("Your pages");
  return ui;
}

// The header "New page" button, distinct from the in-grid "new page" tile.
function headerNewPage(): HTMLElement {
  const heading = screen.getByText("Your pages");
  const header = heading.closest("div")?.parentElement as HTMLElement;
  return within(header).getByRole("button", { name: /New page/ });
}

describe("Dashboard — readiness gate", () => {
  it("shows the skeleton before the gate, then the content after the delay", async () => {
    render(<Dashboard pages={[page()]} />);
    expect(screen.queryByText("Your pages")).toBeNull();
    expect(await screen.findByText("Your pages")).toBeInTheDocument();
  });
});

describe("Dashboard — header summary", () => {
  it("renders the page count and live count, singular for one page", async () => {
    await mountReady([page({ published: true })]);
    expect(screen.getByText(/1 page · 1 live/)).toBeInTheDocument();
  });

  it("pluralizes the count and reflects drafts in the live total", async () => {
    await mountReady([
      page({ id: "a", published: true }),
      page({ id: "b", slug: "b", published: false }),
    ]);
    expect(screen.getByText(/2 pages · 1 live/)).toBeInTheDocument();
  });
});

describe("Dashboard — AI button gate", () => {
  it("hides the AI button when no providers are configured", async () => {
    get.mockResolvedValue({ data: { providers: [] } });
    await mountReady([page()]);
    expect(screen.queryByRole("button", { name: /Generate with AI/ })).toBeNull();
  });

  it("shows the AI button and opens the AI modal when a provider exists", async () => {
    get.mockResolvedValue({ data: { providers: ["mock"] } });
    await mountReady([page()]);
    const aiBtn = await screen.findByRole("button", { name: /Generate with AI/ });
    fireEvent.click(aiBtn);
    expect(screen.getByText("Generate a page with AI")).toBeInTheDocument();
  });
});

describe("Dashboard — ?new=1 deep link", () => {
  it("opens the template modal and replaces the url back to '/'", async () => {
    getParam.current = (k) => (k === "new" ? "1" : null);
    await mountReady([page()]);
    expect(screen.getByText("Choose a starting point")).toBeInTheDocument();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });
});

describe("Dashboard — empty state", () => {
  it("renders the empty state and opens the template modal from its CTA", async () => {
    await mountReady([]);
    const heading = screen.getByText("Create your first page");
    const emptyState = heading.parentElement as HTMLElement;
    expect(heading).toBeInTheDocument();
    fireEvent.click(within(emptyState).getByRole("button", { name: /New page/ }));
    expect(screen.getByText("Choose a starting point")).toBeInTheDocument();
  });
});

describe("Dashboard — search + filter", () => {
  it("filters the visible cards by the search query", async () => {
    await mountReady([
      page({ id: "a", title: "Portfolio", slug: "portfolio" }),
      page({ id: "b", title: "Acme Landing", slug: "acme" }),
    ]);
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Acme Landing")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search pages…"), { target: { value: "acme" } });
    expect(screen.queryByText("Portfolio")).toBeNull();
    expect(screen.getByText("Acme Landing")).toBeInTheDocument();
  });

  it("shows a no-match message and clears filters via the link", async () => {
    await mountReady([page({ title: "Portfolio", slug: "portfolio" })]);
    fireEvent.change(screen.getByPlaceholderText("Search pages…"), { target: { value: "zzz" } });
    expect(screen.getByText(/No pages match/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });
});

describe("Dashboard — create from template", () => {
  it("posts a new page and pushes into the editor when a template is picked", async () => {
    post.mockResolvedValue({ data: { id: "ed-1" } });
    await mountReady([page()]);

    fireEvent.click(headerNewPage());
    fireEvent.click(await screen.findByRole("button", { name: "Use Blank template" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/pages", { title: "Untitled Page", content: [] }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/editor/ed-1"));
  });
});

describe("Dashboard — delete a page", () => {
  it("confirms, deletes, and refreshes the list", async () => {
    del.mockResolvedValue({ data: {} });
    await mountReady([page({ id: "p7", title: "Portfolio", slug: "portfolio" })]);

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/pages/p7"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("does not delete when the confirm is declined", async () => {
    confirmMock.mockResolvedValue(false);
    await mountReady([page({ id: "p7", title: "Portfolio", slug: "portfolio" })]);

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(del).not.toHaveBeenCalled();
  });
});
