import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageThumbnail } from "@/components/dashboard/PageThumbnail";

describe("PageThumbnail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network in test"))));
  });

  it("shows the cached image (cache-busted) when one exists and it is fresh", () => {
    render(
      <PageThumbnail pageId="p1" title="Portfolio" initialUrl="/uploads/thumbnails/p1.png" version={42} stale={false} />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe("/uploads/thumbnails/p1.png?v=42");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a neutral placeholder (no image) when there is none", () => {
    render(<PageThumbnail pageId="p2" title="acme landing" initialUrl={null} version={null} stale={false} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
