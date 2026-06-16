import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Tooltip, TooltipTrigger } from "../Tooltip";
import { Button } from "../Button";

describe("Tooltip", () => {
  it("shows on focus", async () => {
    render(
      <TooltipTrigger delay={0}>
        <Button aria-label="Save">S</Button>
        <Tooltip>Save file</Tooltip>
      </TooltipTrigger>
    );
    await userEvent.tab();
    expect(await screen.findByText("Save file")).toBeInTheDocument();
  });
});
