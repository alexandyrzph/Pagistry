import { describe, it, expect } from "vitest";
import { createPageSchema, updateComponentSchema, emailField } from "@/lib/api/schemas";

describe("createPageSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(createPageSchema.safeParse({}).success).toBe(true);
  });
  it("accepts a valid title + content array", () => {
    expect(createPageSchema.safeParse({ title: "Home", content: [{ type: "hero" }] }).success).toBe(true);
  });
  it("rejects a non-string title", () => {
    expect(createPageSchema.safeParse({ title: 123 }).success).toBe(false);
  });
  it("rejects a title over 120 chars", () => {
    expect(createPageSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
  });
});

describe("updateComponentSchema", () => {
  it("accepts a name and content", () => {
    expect(updateComponentSchema.safeParse({ name: "Card", content: [] }).success).toBe(true);
  });
  it("rejects a non-array content", () => {
    expect(updateComponentSchema.safeParse({ content: { not: "array" } }).success).toBe(false);
  });
});

describe("emailField", () => {
  it("accepts a valid email", () => {
    expect(emailField.safeParse("a@b.com").success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(emailField.safeParse("nope").success).toBe(false);
  });
});
