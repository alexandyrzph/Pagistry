import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Textarea } from "../Textarea";

describe("Textarea", () => {
  it("labels the textarea and reports typed text", async () => {
    const onChange = vi.fn();
    render(<Textarea label="Bio" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Bio"), "hi");
    expect(onChange).toHaveBeenCalled();
  });
});
