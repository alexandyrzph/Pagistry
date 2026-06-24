import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const MOTION_PROPS = new Set(["initial", "animate", "exit", "transition", "layout"]);
  const passthrough = (Tag: string) =>
    function MotionStub(props: Record<string, unknown>) {
      const rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (k !== "children" && !MOTION_PROPS.has(k)) rest[k] = v;
      }
      return React.createElement(Tag, rest, props.children as React.ReactNode);
    };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }) as Record<
      string,
      unknown
    >,
  };
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { CreateWorkspaceModal } from "@/components/setup/CreateWorkspaceModal";

describe("CreateWorkspaceModal", () => {
  it("renders both the workspace and site fields", () => {
    render(
      <DialogProvider>
        <CreateWorkspaceModal open onClose={() => {}} />
      </DialogProvider>,
    );
    expect(screen.getByPlaceholderText("Acme Inc.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Marketing site")).toBeTruthy();
  });
});
