import { describe, it, expect } from "vitest";
import { filterPages } from "@/lib/dashboard/filter";

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
    expect(filterPages(pages, "", "live").map((p) => p.slug)).toEqual(["portfolio", "acme-landing"]);
    expect(filterPages(pages, "", "drafts").map((p) => p.slug)).toEqual(["untitled-page"]);
  });
  it("combines query and filter", () => {
    expect(filterPages(pages, "a", "live").map((p) => p.slug)).toEqual(["acme-landing"]);
  });
});
