import { describe, it, expect } from "vitest";
import { responsiveCss } from "@/lib/styles";
import { buildExportDocument } from "@/lib/export-html";
import type { Block } from "@/lib/types";

const tree: Block[] = [
  {
    id: "x1",
    type: "section",
    props: {},
    styles: {
      desktop: { backgroundColor: "#ffffff", paddingTop: "40px" },
      tablet: { paddingTop: "24px" },
      mobile: { paddingTop: "12px" },
    },
    children: [],
  },
];

describe("responsiveCss", () => {
  it("emits scoped base rules", () => {
    const css = responsiveCss(tree);
    expect(css).toContain(".b-x1 { background-color: #ffffff; padding-top: 40px; }");
  });

  it("wraps tablet and mobile overrides in media queries", () => {
    const css = responsiveCss(tree);
    expect(css).toContain("@media (max-width: 1024px)");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toMatch(/@media \(max-width: 640px\) \{[\s\S]*\.b-x1 \{ padding-top: 12px; \}/);
  });
});

describe("buildExportDocument", () => {
  it("produces a self-contained document", () => {
    const html = buildExportDocument("My Page", "<section>hi</section>", tree);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>My Page</title>");
    expect(html).toContain("<section>hi</section>");
    expect(html).toContain("cdn.tailwindcss.com");
    expect(html).toContain(".pb-columns");
  });

  it("escapes the title", () => {
    const html = buildExportDocument("<script>", "", tree);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<title><script></title>");
  });
});
