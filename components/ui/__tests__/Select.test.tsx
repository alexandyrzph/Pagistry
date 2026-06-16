import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Select } from "../Select";

const items = [{ id: "admin", label: "Admin" }, { id: "editor", label: "Editor" }];

describe("Select", () => {
  it("opens and reports the chosen key", async () => {
    const onSelectionChange = vi.fn();
    render(<Select label="Role" items={items} onSelectionChange={onSelectionChange} />);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(await screen.findByRole("option", { name: "Editor" }));
    expect(onSelectionChange).toHaveBeenCalledWith("editor");
  });
});
