import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("test infra", () => {
  it("renders and jest-dom matchers work", () => {
    render(<button>hi</button>);
    expect(screen.getByRole("button", { name: "hi" })).toBeInTheDocument();
  });
});
