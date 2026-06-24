import { describe, it, expect } from "vitest";
import { siteInitial } from "@/components/app-shell/SiteSwitcher.helpers";

describe("siteInitial", () => {
  it("uppercases the first character", () => {
    expect(siteInitial("marketing")).toBe("M");
  });
  it("falls back to S for empty names", () => {
    expect(siteInitial("")).toBe("S");
    expect(siteInitial(undefined)).toBe("S");
  });
});
