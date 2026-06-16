import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Switch } from "../Switch";

describe("Switch", () => {
  it("toggles and reports the new value", async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>Published</Switch>);
    await userEvent.click(screen.getByRole("switch", { name: "Published" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
