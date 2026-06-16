import { describe, it, expect } from "vitest";
import { ROLE_RANK, hasRole, slugCandidate } from "@/lib/auth/workspace";

describe("role ranking", () => {
  it("orders roles VIEWER < EDITOR < ADMIN < OWNER", () => {
    expect(ROLE_RANK.VIEWER).toBeLessThan(ROLE_RANK.EDITOR);
    expect(ROLE_RANK.EDITOR).toBeLessThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeLessThan(ROLE_RANK.OWNER);
  });

  it("hasRole is true when role meets or exceeds the minimum", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("EDITOR", "ADMIN")).toBe(false);
    expect(hasRole("VIEWER", "EDITOR")).toBe(false);
    expect(hasRole("EDITOR", "VIEWER")).toBe(true);
  });
});

describe("slugCandidate", () => {
  it("produces a kebab base for n=1 and suffixes for n>1", () => {
    expect(slugCandidate("My Team", 1)).toBe("my-team");
    expect(slugCandidate("My Team", 3)).toBe("my-team-3");
  });
  it("falls back to 'workspace' for empty input", () => {
    expect(slugCandidate("   ", 1)).toBe("workspace");
  });
});
