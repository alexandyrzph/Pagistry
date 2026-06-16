import { responsiveCss } from "./styles";
import type { Block } from "@/lib/types";

// Base reset + page typography shared by the public page and HTML export.
export const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; display: block; }
a { color: inherit; }
h1,h2,h3,h4,h5,h6,p,ul,blockquote,figure { margin: 0; }
ul { padding: 0; list-style: none; }
@media (max-width: 640px) { .pb-columns { grid-template-columns: 1fr !important; } }
`.trim();

/**
 * Assemble a self-contained HTML document from already-rendered clean body
 * markup plus the tree's responsive stylesheet. Tailwind is pulled from a CDN
 * so utility classes used by the blocks resolve in the standalone file.
 */
export function buildExportDocument(
  title: string,
  bodyHtml: string,
  tree: Block[],
  extraCss = ""
): string {
  const css = `${BASE_CSS}\n${extraCss}\n${responsiveCss(tree)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
${css}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
