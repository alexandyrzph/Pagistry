import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceForm } from "@/components/setup/WorkspaceForm";
import { DialogProvider } from "@/components/ui/dialog-provider";

describe("WorkspaceForm", () => {
  it("emits name changes through onChange", () => {
    const onChange = vi.fn();
    render(
      <DialogProvider>
        <WorkspaceForm value={{ name: "", logoUrl: "" }} onChange={onChange} />
      </DialogProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText("Acme Inc."), { target: { value: "My Co" } });
    expect(onChange).toHaveBeenCalledWith({ name: "My Co", logoUrl: "" });
  });
});
