import { CodeXml, Braces } from "lucide-react";
import type { BlockDefinition } from "@/lib/blocks/registry-types";
import { EmbedBlock, CodeBlock } from "./embed";

export const embedBlocks: BlockDefinition[] = [
  {
    type: "embed",
    label: "Embed / HTML",
    icon: CodeXml,
    category: "Basic",
    description: "Paste custom HTML, an iframe or a third-party embed snippet.",
    defaultProps: { html: "" },
    defaultStyles: { desktop: {} },
    fields: [
      {
        key: "html",
        label: "Embed / HTML code",
        type: "code",
        placeholder: '<iframe src="https://..." width="100%" height="400"></iframe>',
      },
    ],
    styleGroups: ["spacing", "background", "border", "layout"],
    Render: EmbedBlock,
  },
  {
    type: "code",
    label: "Code",
    icon: Braces,
    category: "Basic",
    description: "Display a formatted code snippet to your readers.",
    defaultProps: { code: "", language: "" },
    defaultStyles: { desktop: { borderRadius: "12px" } },
    fields: [
      { key: "language", label: "Language label", type: "text", placeholder: "html, js, css…" },
      { key: "code", label: "Code", type: "code", placeholder: "Paste your code…" },
    ],
    styleGroups: ["spacing", "border"],
    Render: CodeBlock,
  },
];
