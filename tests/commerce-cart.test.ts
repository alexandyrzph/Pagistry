import { describe, it, expect } from "vitest";
import { cartSubtotal, clampQuantity, cartLineCount } from "@/lib/commerce/cart";

describe("cart math", () => {
  it("sums line totals", () => {
    expect(
      cartSubtotal([
        { unitAmount: 1500, quantity: 2 },
        { unitAmount: 500, quantity: 1 },
      ]),
    ).toBe(3500);
    expect(cartSubtotal([])).toBe(0);
  });
  it("counts total units", () => {
    expect(cartLineCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });
  it("clamps quantity to available stock under deny, allows under continue", () => {
    expect(clampQuantity(5, 3, "deny")).toBe(3);
    expect(clampQuantity(2, 3, "deny")).toBe(2);
    expect(clampQuantity(5, 3, "continue")).toBe(5);
    expect(clampQuantity(5, -1, "deny")).toBe(5);
    expect(clampQuantity(0, 3, "deny")).toBe(1);
  });
});
