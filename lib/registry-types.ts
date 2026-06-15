import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type {
  Block,
  BlockCategory,
  ResponsiveStyles,
  SettingField,
  StyleGroup,
  Viewport,
} from "./types";

/** Props every block render component receives. */
export type BlockRenderProps = {
  block: Block;
  viewport: Viewport;
  editable: boolean;
  selected: boolean;
  /** resolved inline styles (incl. layout) to apply to the block root */
  style: CSSProperties;
  /** class string incl. the per-block `b-<id>` hook + any author custom classes */
  className: string;
  /** author-set HTML id for the block root (custom attributes), if any */
  id?: string;
  /** rendered child blocks (for containers) */
  children?: ReactNode;
  /** commit a prop change (used for inline text editing) */
  setProp: (key: string, value: any) => void;
};

export type BlockDefinition = {
  type: string;
  label: string;
  icon: LucideIcon;
  category: BlockCategory;
  description?: string;
  /** accepts dropped children */
  isContainer?: boolean;
  defaultProps: Record<string, any>;
  defaultStyles: ResponsiveStyles;
  /** content fields shown in the inspector */
  fields: SettingField[];
  /** which style control groups to expose */
  styleGroups: StyleGroup[];
  Render: ComponentType<BlockRenderProps>;
  /** default children created on instantiation (e.g. columns -> N columns) */
  createChildren?: () => Block[];
  /**
   * Optional custom inspector for the Content tab. When present it replaces the
   * generic `fields` editor — used by blocks whose options depend on external
   * data (e.g. the Collection List, whose bindings come from a chosen collection).
   */
  CustomContent?: ComponentType<{ block: Block }>;
};
