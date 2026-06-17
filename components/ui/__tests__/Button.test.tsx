import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children and fires onPress on click", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("is disabled while loading", () => {
    render(<Button isLoading>Save</Button>);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("applies primary variant and md size classes by default", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn).toHaveClass("bg-brand-600");
    expect(btn).toHaveClass("h-9");
  });

  it("applies the neutral variant", () => {
    render(<Button variant="neutral">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-fg");
  });

  it("renders the link variant inline without button padding", () => {
    render(<Button variant="link">More</Button>);
    const btn = screen.getByRole("button", { name: "More" });
    expect(btn).toHaveClass("p-0");
    expect(btn).not.toHaveClass("h-9");
  });
});
