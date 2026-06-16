import { describe, it, expect } from "vitest";
import { parseJsonArray, parseJsonObject } from "@/lib/api/json-parse";

describe("parseJsonArray", () => {
  it("returns the array for a valid JSON array", () => {
    expect(parseJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("returns [] for a JSON object", () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
  it("returns [] for invalid JSON", () => {
    expect(parseJsonArray("not json")).toEqual([]);
  });
});

describe("parseJsonObject", () => {
  it("returns the object for a valid JSON object", () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns {} for a JSON array", () => {
    expect(parseJsonObject("[1,2]")).toEqual({});
  });
  it("returns {} for invalid JSON", () => {
    expect(parseJsonObject("nope")).toEqual({});
  });
});
