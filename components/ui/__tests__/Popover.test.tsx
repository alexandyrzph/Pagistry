import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogTrigger, Dialog } from "react-aria-components";
import { describe, it, expect } from "vitest";
import { Popover } from "../Popover";
import { Button } from "../Button";

describe("Popover", () => {
  it("reveals its content when the trigger is pressed", async () => {
    render(
      <DialogTrigger>
        <Button>Pick</Button>
        <Popover>
          <Dialog className="p-2 outline-none">Swatches</Dialog>
        </Popover>
      </DialogTrigger>
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick" }));
    expect(await screen.findByText("Swatches")).toBeInTheDocument();
  });
});
