import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { DialogProvider, useConfirm } from "../dialog-provider";

function Harness() {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        (window as any).__r = await confirm({ title: "Sure?", confirmLabel: "Yes", cancelLabel: "No" });
      }}
    >
      ask
    </button>
  );
}

describe("dialog-provider", () => {
  it("resolves true when the confirm button is pressed", async () => {
    render(<DialogProvider><Harness /></DialogProvider>);
    await userEvent.click(screen.getByRole("button", { name: "ask" }));
    await userEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await new Promise((r) => setTimeout(r, 10));
    expect((window as any).__r).toBe(true);
  });
});
