import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { useEditor } from "@/store/editor-store";
import { PagePanel } from "@/components/editor/PagePanel";

describe("PagePanel", () => {
  beforeEach(() => {
    useEditor
      .getState()
      .init({
        id: "p1",
        title: "About",
        slug: "about",
        published: false,
        noindex: false,
        tree: [],
      });
  });
  it("shows the current slug", () => {
    render(
      <DialogProvider>
        <PagePanel />
      </DialogProvider>,
    );
    expect((screen.getByDisplayValue("about") as HTMLInputElement).value).toBe("about");
  });
});
