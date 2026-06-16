import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Popover } from "@/components/editor/Popover";

describe("Popover (dom)", () => {
  it("renders children when open", () => {
    render(<Popover open onClose={() => {}}><span>menu</span></Popover>);
    expect(screen.getByText("menu")).toBeInTheDocument();
  });
  it("renders nothing when closed", () => {
    render(<Popover open={false} onClose={() => {}}><span>menu</span></Popover>);
    expect(screen.queryByText("menu")).toBeNull();
  });
  it("calls onClose when the overlay is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<Popover open onClose={onClose}><span>menu</span></Popover>);
    const overlay = container.querySelector(".fixed.inset-0")!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
