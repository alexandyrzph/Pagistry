import { describe, it, expect } from "vitest";
import { responsiveCss, resolveStyles, BREAKPOINTS } from "@/lib/styles";
import type { Block } from "@/lib/types";

const block = (id: string, extra: Partial<Block> = {}): Block => ({
  id,
  type: "text",
  props: {},
  styles: {},
  children: [],
  ...extra,
});

describe("resolveStyles cascade", () => {
  it("merges desktop → tablet → mobile (desktop-first)", () => {
    const styles = {
      desktop: { color: "#111", fontSize: "20px" },
      tablet: { fontSize: "16px" },
      mobile: { fontSize: "14px" },
    };
    expect(resolveStyles(styles, "desktop")).toEqual({ color: "#111", fontSize: "20px" });
    expect(resolveStyles(styles, "tablet")).toEqual({ color: "#111", fontSize: "16px" });
    expect(resolveStyles(styles, "mobile")).toEqual({ color: "#111", fontSize: "14px" });
  });
});

describe("responsiveCss visibility", () => {
  it("hides a block on the public page with display:none in a bounded range", () => {
    const tree = [block("x", { props: { hidden: { mobile: true } } })];
    const css = responsiveCss(tree);
    expect(css).toContain(`@media (max-width: ${BREAKPOINTS.mobile}px)`);
    expect(css).toContain(".b-x { display: none !important; }");
  });

  it("uses a bounded range so tablet visibility is independent of mobile", () => {
    const css = responsiveCss([block("x", { props: { hidden: { tablet: true } } })]);
    expect(css).toContain(
      `@media (min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`
    );
  });

  it("ghosts (not removes) a hidden block in editor mode so it stays selectable", () => {
    const css = responsiveCss([block("x", { props: { hidden: { desktop: true } } })], { editable: true });
    expect(css).toContain(`@media (min-width: ${BREAKPOINTS.tablet + 1}px)`);
    expect(css).toContain("opacity: 0.35 !important");
    expect(css).not.toContain("display: none");
  });

  it("emits no visibility rules when nothing is hidden", () => {
    const css = responsiveCss([block("x")]);
    expect(css).not.toContain("display: none");
    expect(css).not.toContain("opacity: 0.35");
  });
});
