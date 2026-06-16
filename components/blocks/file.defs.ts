import { FileText } from "lucide-react";
import type { BlockDefinition } from "@/lib/blocks/registry-types";
import { FileBlock } from "./file";
import { ALIGN_OPTIONS } from "./shared.defs";

export const fileBlocks: BlockDefinition[] = [
  {
    type: "file",
    label: "File",
    icon: FileText,
    category: "Basic",
    description: "A downloadable file card",
    defaultProps: { url: "", title: "Download file", description: "Click to download", align: "left" },
    defaultStyles: { desktop: {} },
    fields: [
      { key: "url", label: "File", type: "file" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "align", label: "Align", type: "select", options: ALIGN_OPTIONS },
    ],
    styleGroups: ["spacing"],
    Render: FileBlock,
  },
];
