import { describe, it, expect } from "vitest";
import { isThumbnailStale } from "@/lib/thumbnails/staleness";

describe("isThumbnailStale", () => {
  const updated = new Date("2026-06-16T12:00:00Z");

  it("is stale when never taken", () => {
    expect(isThumbnailStale(null, updated)).toBe(true);
    expect(isThumbnailStale(undefined, updated)).toBe(true);
  });

  it("is stale when the shot predates the last edit", () => {
    expect(isThumbnailStale(new Date("2026-06-16T11:59:59Z"), updated)).toBe(true);
  });

  it("is fresh when the shot matches or postdates the last edit", () => {
    expect(isThumbnailStale(updated, updated)).toBe(false);
    expect(isThumbnailStale(new Date("2026-06-16T12:00:01Z"), updated)).toBe(false);
  });

  it("accepts ISO strings", () => {
    expect(isThumbnailStale("2026-06-16T11:00:00Z", "2026-06-16T12:00:00Z")).toBe(true);
  });
});
