import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ToggleButtonGroup, ToggleButton } from "../ToggleButtonGroup";

describe("ToggleButtonGroup", () => {
  it("reports the newly selected key on click (single select)", async () => {
    const onSelectionChange = vi.fn();
    render(
      <ToggleButtonGroup
        aria-label="Align"
        selectionMode="single"
        selectedKeys={new Set(["left"])}
        onSelectionChange={onSelectionChange}
      >
        <ToggleButton id="left">Left</ToggleButton>
        <ToggleButton id="center">Center</ToggleButton>
        <ToggleButton id="right">Right</ToggleButton>
      </ToggleButtonGroup>,
    );

    // In single-select mode RAC exposes the group as a radiogroup and each
    // ToggleButton as a radio (multiple-select would use button/pressed instead).
    await userEvent.click(screen.getByRole("radio", { name: "Center" }));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const selected = onSelectionChange.mock.calls[0][0] as Set<string>;
    expect(selected).toBeInstanceOf(Set);
    expect(selected.has("center")).toBe(true);
  });
});
