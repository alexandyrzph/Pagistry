import { Database } from "lucide-react";
import type { BlockDefinition } from "@/lib/registry-types";
import { CollectionListBlock } from "./collection";
import { CollectionInspector } from "@/components/editor/CollectionInspector";

export const collectionBlocks: BlockDefinition[] = [
  {
    type: "collection",
    label: "Collection List",
    icon: Database,
    category: "Dynamic",
    description: "Repeat a card across a CMS collection's items",
    defaultProps: {
      collectionId: "",
      layout: "grid",
      columns: "3",
      limit: 0,
      bindings: { image: "", title: "", subtitle: "", text: "", link: "" },
    },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [],
    styleGroups: ["background", "spacing"],
    Render: CollectionListBlock,
    CustomContent: CollectionInspector,
  },
];
