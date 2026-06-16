import { describe, it, expect } from "vitest";
import * as ui from "..";

describe("ui barrel", () => {
  it("re-exports the primitive surface", () => {
    for (const name of [
      "Button", "TextField", "Textarea", "Select", "Menu", "MenuItem",
      "MenuTrigger", "Popover", "Checkbox", "Switch", "RadioGroup", "Radio",
      "Tooltip", "TooltipTrigger", "Modal", "Table", "Skeleton",
      "DialogProvider", "useConfirm", "useAlert",
    ]) {
      expect(ui[name as keyof typeof ui], `missing export: ${name}`).toBeDefined();
    }
  });
});
