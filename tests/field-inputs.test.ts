import { describe, it, expect } from "vitest";
import { LEAF_INPUTS } from "@/lib/field-inputs";
import { FIELD_TYPES } from "@/lib/types";

const CMS_TYPES = ["text", "textarea", "image", "url", "number", "date", "boolean"] as const;

describe("LEAF_INPUTS", () => {
  it("has a renderer for every inspector field type except 'items'", () => {
    for (const t of FIELD_TYPES) {
      if (t === "items") continue;
      expect(typeof LEAF_INPUTS[t]).toBe("function");
    }
  });

  it("does NOT handle 'items' (recursive — handled by the consumer)", () => {
    expect(LEAF_INPUTS.items).toBeUndefined();
  });

  it("has a renderer for every CMS field type", () => {
    for (const t of CMS_TYPES) {
      expect(typeof LEAF_INPUTS[t]).toBe("function");
    }
  });
});
