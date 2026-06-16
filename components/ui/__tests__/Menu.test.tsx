import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuTrigger } from "react-aria-components";
import { describe, it, expect, vi } from "vitest";
import { Menu, MenuItemRow } from "../Menu";
import { Button } from "../Button";

describe("Menu", () => {
  it("opens on trigger and fires onAction with the item key", async () => {
    const onAction = vi.fn();
    render(
      <MenuTrigger>
        <Button>Open</Button>
        <Menu onAction={onAction}>
          <MenuItemRow id="dup">Duplicate</MenuItemRow>
          <MenuItemRow id="del">Delete</MenuItemRow>
        </Menu>
      </MenuTrigger>
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(onAction).toHaveBeenCalledWith("dup");
  });
});
