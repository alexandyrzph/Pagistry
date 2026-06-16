import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RadioGroup, Radio } from "../RadioGroup";

describe("RadioGroup", () => {
  it("reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup label="Plan" onChange={onChange}>
        <Radio value="free">Free</Radio>
        <Radio value="pro">Pro</Radio>
      </RadioGroup>
    );
    await userEvent.click(screen.getByRole("radio", { name: "Pro" }));
    expect(onChange).toHaveBeenCalledWith("pro");
  });
});
