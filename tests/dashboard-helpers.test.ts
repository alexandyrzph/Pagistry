// Unit tests for the pure logic extracted from <Dashboard/>: count derivation,
// title picking, the async create/remove/generate actions, and the three effect
// bodies. The api client and axios are mocked so the actions can be driven
// through every branch without a DOM.
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from "@/lib/api/client";
import {
  AI_EXAMPLES,
  clearNewParam,
  computeCounts,
  gateReady,
  generatePage,
  pickGeneratedTitle,
  runCreate,
  runRemove,
  type PageItem,
} from "@/components/dashboard/Dashboard.helpers";
import type { Template } from "@/lib/blocks/templates";

const get = api.get as unknown as Mock;
const post = api.post as unknown as Mock;
const del = api.delete as unknown as Mock;

function page(over: Partial<PageItem> = {}): PageItem {
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
  get.mockReset();
  post.mockReset();
  del.mockReset();
});

describe("computeCounts", () => {
  it("returns zeros for an empty list", () => {
    expect(computeCounts([])).toEqual({ all: 0, live: 0, drafts: 0 });
  });

  it("splits published and draft pages", () => {
    const pages = [
      page({ id: "a", published: true }),
      page({ id: "b", published: true }),
      page({ id: "c", published: false }),
    ];
    expect(computeCounts(pages)).toEqual({ all: 3, live: 2, drafts: 1 });
  });
});

describe("pickGeneratedTitle", () => {
  it("uses the first block title when present", () => {
    const blocks = [{ props: {} }, { props: { title: "Hello World" } }];
    expect(pickGeneratedTitle(blocks, "the prompt")).toBe("Hello World");
  });

  it("falls back to the prompt when no block has a truthy title", () => {
    expect(pickGeneratedTitle([{ props: {} }, {}], "fallback prompt")).toBe("fallback prompt");
  });

  it("treats an empty-string block title as absent (falls back to prompt)", () => {
    expect(pickGeneratedTitle([{ props: { title: "" } }], "use me")).toBe("use me");
  });

  it("clamps the result to 60 characters", () => {
    const long = "x".repeat(120);
    expect(pickGeneratedTitle([], long)).toHaveLength(60);
  });
});

describe("generatePage", () => {
  it("posts the prompt, derives the title from blocks, and returns the new id", async () => {
    post
      .mockResolvedValueOnce({ data: { blocks: [{ props: { title: "From AI" } }] } })
      .mockResolvedValueOnce({ data: { id: "new-id" } });

    const id = await generatePage("Build me a page");

    expect(id).toBe("new-id");
    expect(post).toHaveBeenNthCalledWith(1, "/api/ai", { mode: "page", prompt: "Build me a page" });
    expect(post).toHaveBeenNthCalledWith(2, "/api/pages", {
      title: "From AI",
      content: [{ props: { title: "From AI" } }],
    });
  });

  it("defaults blocks to [] when the AI response omits them and uses the prompt as title", async () => {
    post.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { id: "x" } });

    await generatePage("My prompt");

    expect(post).toHaveBeenNthCalledWith(2, "/api/pages", { title: "My prompt", content: [] });
  });

  it("returns null when the created page has no id", async () => {
    post.mockResolvedValueOnce({ data: { blocks: [] } }).mockResolvedValueOnce({ data: {} });
    expect(await generatePage("p")).toBeNull();
  });

  it("throws a generic error when the AI call rejects with a non-axios error", async () => {
    post.mockRejectedValueOnce(new Error("boom"));
    await expect(generatePage("p")).rejects.toThrow("Generation failed");
  });

  it("surfaces the server error message from an axios error response", async () => {
    const axiosErr = Object.assign(new Error("req failed"), {
      isAxiosError: true,
      response: { data: { error: "rate limited" } },
    });
    post.mockRejectedValueOnce(axiosErr);
    await expect(generatePage("p")).rejects.toThrow("rate limited");
  });
});

describe("runCreate", () => {
  function template(over: Partial<Template> = {}): Template {
    return {
      id: "landing",
      name: "Landing page",
      description: "desc",
      build: () => [],
      ...over,
    };
  }

  it("posts the template name + built content and navigates into the editor", async () => {
    post.mockResolvedValueOnce({ data: { id: "ed1" } });
    const setCreating = vi.fn();
    const push = vi.fn();

    await runCreate(template(), setCreating, push);

    expect(setCreating).toHaveBeenCalledWith("landing");
    expect(post).toHaveBeenCalledWith("/api/pages", { title: "Landing page", content: [] });
    expect(push).toHaveBeenCalledWith("/editor/ed1");
  });

  it("uses the 'Untitled Page' title for the blank template", async () => {
    post.mockResolvedValueOnce({ data: { id: " b" } });
    await runCreate(template({ id: "blank", name: "Blank" }), vi.fn(), vi.fn());
    expect(post).toHaveBeenCalledWith("/api/pages", { title: "Untitled Page", content: [] });
  });

  it("clears the creating flag and does not navigate when the request fails", async () => {
    post.mockRejectedValueOnce(new Error("nope"));
    const setCreating = vi.fn();
    const push = vi.fn();

    await runCreate(template(), setCreating, push);

    expect(setCreating).toHaveBeenNthCalledWith(1, "landing");
    expect(setCreating).toHaveBeenLastCalledWith(null);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("runRemove", () => {
  it("does nothing when the confirm is declined", async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const setDeleting = vi.fn();
    const refresh = vi.fn();

    await runRemove("p1", confirm, setDeleting, refresh);

    expect(del).not.toHaveBeenCalled();
    expect(setDeleting).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deletes then refreshes and toggles the deleting flag when confirmed", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    del.mockResolvedValueOnce({ data: {} });
    const setDeleting = vi.fn();
    const refresh = vi.fn();

    await runRemove("p9", confirm, setDeleting, refresh);

    expect(confirm).toHaveBeenCalledWith({
      title: "Delete page?",
      message: "This page will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    expect(del).toHaveBeenCalledWith("/api/pages/p9");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setDeleting).toHaveBeenNthCalledWith(1, "p9");
    expect(setDeleting).toHaveBeenLastCalledWith(null);
  });

  it("resets the deleting flag even when the delete request throws", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    del.mockRejectedValueOnce(new Error("server down"));
    const setDeleting = vi.fn();
    const refresh = vi.fn();

    await expect(runRemove("p1", confirm, setDeleting, refresh)).rejects.toThrow("server down");
    expect(setDeleting).toHaveBeenLastCalledWith(null);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("effect bodies", () => {
  it("gateReady flips ready after 500ms and the cleanup cancels a pending timer", () => {
    vi.useFakeTimers();
    const setReady = vi.fn();
    const cleanup = gateReady(setReady);
    expect(setReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(setReady).toHaveBeenCalledWith(true);

    const setReady2 = vi.fn();
    gateReady(setReady2)();
    vi.advanceTimersByTime(1000);
    expect(setReady2).not.toHaveBeenCalled();
    cleanup();
    vi.useRealTimers();
  });

  it("clearNewParam replaces to '/' only when the new param is '1'", () => {
    const router = { replace: vi.fn() };
    clearNewParam({ get: () => "1" } as never, router as never);
    expect(router.replace).toHaveBeenCalledWith("/");

    router.replace.mockReset();
    clearNewParam({ get: () => null } as never, router as never);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("AI_EXAMPLES", () => {
  it("exposes the example prompt suggestions", () => {
    expect(AI_EXAMPLES).toHaveLength(4);
    expect(AI_EXAMPLES[0]).toMatch(/SaaS analytics/);
  });
});
