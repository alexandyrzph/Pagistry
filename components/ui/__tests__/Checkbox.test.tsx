import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("toggles and reports the new value", async () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>Accept</Checkbox>);
    await userEvent.click(screen.getByRole("checkbox", { name: "Accept" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders the indeterminate state", () => {
    render(<Checkbox isIndeterminate>Partial</Checkbox>);
    expect(screen.getByRole("checkbox", { name: "Partial" })).toBePartiallyChecked();
  });
});
