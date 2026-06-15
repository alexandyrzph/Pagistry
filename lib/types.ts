// ---------------------------------------------------------------------------
// Core data model for the page builder.
// A page is a recursive tree of Block nodes. The same tree is rendered in the
// editor canvas (with chrome) and on the public page (clean).
// ---------------------------------------------------------------------------

export type Viewport = "desktop" | "tablet" | "mobile";

export const VIEWPORTS: Viewport[] = ["desktop", "tablet", "mobile"];

/** Page-level design tokens that cascade across all blocks. */
export type Theme = {
  brand?: string;
  font?: string;
  radius?: string;
};

export type Seo = {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
};

// --- Design system (site-wide shared styles) --------------------------------

/** A named, reusable color. Blocks reference it via `var(--pc-color-<id>)`. */
export type ColorToken = { id: string; name: string; value: string };

/** A named typography preset. Linked blocks get the `ts-<id>` class. */
export type TextStyle = { id: string; name: string; props: StyleProps };

export type DesignSystem = { colors: ColorToken[]; textStyles: TextStyle[] };

// --- CMS ---------------------------------------------------------------------

/** The kinds of fields a CMS collection can define. */
export type CmsFieldType =
  | "text"
  | "textarea"
  | "image"
  | "url"
  | "number"
  | "date"
  | "boolean";

/** A single field in a collection's schema. */
export type CollectionField = {
  key: string;
  label: string;
  type: CmsFieldType;
};

/** One entry in a collection. `data` maps field key -> value. */
export type CollectionItem = {
  id: string;
  data: Record<string, any>;
  order: number;
};

/** A collection plus its items, as resolved for rendering. */
export type CollectionData = {
  id: string;
  name: string;
  slug: string;
  fields: CollectionField[];
  items: CollectionItem[];
  detailEnabled?: boolean;
};

/** Maps a collection id -> its data (mirrors the components map). */
export type CollectionMap = Record<string, CollectionData>;

/** Which collection field fills each visual slot of a Collection List card. */
export type CardBindings = {
  image?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  link?: string;
};

/** CSS-ish style properties an author can set per viewport. */
export type StyleProps = {
  // spacing
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  // typography
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  textTransform?: string;
  fontFamily?: string;
  // background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  // border
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  // effects
  boxShadow?: string;
  opacity?: string;
  // sizing / layout
  width?: string;
  maxWidth?: string;
  minHeight?: string;
  display?: string;
  gap?: string;
  alignItems?: string;
  justifyContent?: string;
};

export type ResponsiveStyles = {
  desktop?: StyleProps;
  tablet?: StyleProps;
  mobile?: StyleProps;
};

export type Block = {
  id: string;
  type: string;
  props: Record<string, any>;
  styles: ResponsiveStyles;
  children: Block[];
};

export type BlockCategory = "Layout" | "Basic" | "Sections" | "Dynamic";

// --- Inspector field schema (drives the content controls) -------------------

export type FieldType =
  | "text"
  | "textarea"
  | "code" // monospace multi-line input (HTML embeds / code blocks)
  | "number"
  | "select"
  | "color"
  | "image"
  | "url"
  | "boolean"
  | "icon"
  | "file" // uploaded file URL
  | "stringlist" // repeatable list of plain strings
  | "items"; // repeatable list of {primary, secondary, ...}

/** Runtime list of every FieldType (keep in sync with the FieldType union). */
export const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "code",
  "number",
  "select",
  "color",
  "image",
  "url",
  "boolean",
  "icon",
  "file",
  "stringlist",
  "items",
];

export type SelectOption = { label: string; value: string };

export type SettingField = {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  placeholder?: string;
  /** for "items": the sub-fields of each item */
  itemFields?: { key: string; label: string; type: FieldType; options?: SelectOption[] }[];
};

// --- Style control groups shown in the inspector ----------------------------

export type StyleGroup =
  | "typography"
  | "spacing"
  | "background"
  | "border"
  | "effects"
  | "layout";
