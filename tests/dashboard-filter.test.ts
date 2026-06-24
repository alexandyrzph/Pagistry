import { describe, it, expect } from "vitest";
import { filterPages, emptyStateMessage } from "@/lib/dashboard/filter";

const pages = [
  { title: "Portfolio", slug: "portfolio", published: true },
  { title: "Acme Landing", slug: "acme-landing", published: true },
  { title: "Untitled Page", slug: "untitled-page", published: false },
];

describe("filterPages", () => {
  it("returns all pages when query empty and filter is all", () => {
    expect(filterPages(pages, "", "all")).toHaveLength(3);
  });
  it("matches by title, case-insensitively", () => {
    expect(filterPages(pages, "port", "all").map((p) => p.slug)).toEqual(["portfolio"]);
    expect(filterPages(pages, "ACME", "all").map((p) => p.slug)).toEqual(["acme-landing"]);
  });
  it("matches by slug", () => {
    expect(filterPages(pages, "untitled", "all").map((p) => p.slug)).toEqual(["untitled-page"]);
  });
  it("filters live and drafts", () => {
    expect(filterPages(pages, "", "live").map((p) => p.slug)).toEqual([
      "portfolio",
      "acme-landing",
    ]);
    expect(filterPages(pages, "", "drafts").map((p) => p.slug)).toEqual(["untitled-page"]);
  });
  it("combines query and filter", () => {
    expect(filterPages(pages, "a", "live").map((p) => p.slug)).toEqual(["acme-landing"]);
  });
});

describe("emptyStateMessage", () => {
  it("uses the search query when the user is searching", () => {
    expect(emptyStateMessage("foo", "all")).toBe("No pages match “foo”");
    expect(emptyStateMessage("foo", "live")).toBe("No pages match “foo”");
  });
  it("describes the active status filter when the query is empty", () => {
    expect(emptyStateMessage("", "live")).toBe("No live pages yet");
    expect(emptyStateMessage("   ", "drafts")).toBe("No drafts yet");
    expect(emptyStateMessage("", "all")).toBe("No pages yet");
  });
});
