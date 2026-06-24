import { describe, it, expect } from "vitest";
import { hasActiveDomain } from "@/lib/domains/active";

describe("hasActiveDomain", () => {
  it("is true when any domain is ACTIVE", () => {
    expect(hasActiveDomain([{ status: "PENDING" }, { status: "ACTIVE" }])).toBe(true);
  });
  it("is false with no active domains", () => {
    expect(hasActiveDomain([{ status: "PENDING" }, { status: "ERROR" }])).toBe(false);
  });
  it("is false for empty arrays and non-arrays", () => {
    expect(hasActiveDomain([])).toBe(false);
    expect(hasActiveDomain(null)).toBe(false);
    expect(hasActiveDomain(undefined)).toBe(false);
  });
});
