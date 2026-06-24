import { describe, it, expect } from "vitest";
import { pageSlugFrom } from "@/lib/pages/slug";

describe("pageSlugFrom", () => {
  it("kebab-cases and strips leading slashes", () => {
    expect(pageSlugFrom("/About Us/")).toBe("about-us");
    expect(pageSlugFrom("Pricing & Plans")).toBe("pricing-plans");
  });
  it("returns empty string for blank input", () => {
    expect(pageSlugFrom("   ")).toBe("");
  });
});
