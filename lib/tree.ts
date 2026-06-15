import type { Block, ResponsiveStyles, StyleProps, Viewport } from "./types";
import { uid } from "./utils";

// ---------------------------------------------------------------------------
// Pure, immutable operations over the block tree (Block[]).
// Every mutation returns a NEW tree so the editor can snapshot for undo/redo.
// `parentId === null` always refers to the page root.
// ---------------------------------------------------------------------------

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function findBlockById(tree: Block[], id: string): Block | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findBlockById(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Ancestor chain from the root down to (and including) the block with `id`. */
export function pathToBlock(tree: Block[], id: string): Block[] | null {
  for (const node of tree) {
    if (node.id === id) return [node];
    const sub = pathToBlock(node.children, id);
    if (sub) return [node, ...sub];
  }
  return null;
}

/** Locate a block's parent id (null = root) and its index within that parent. */
export function locate(
  tree: Block[],
  id: string,
  parentId: string | null = null
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    if (node.id === id) return { parentId, index: i };
    const found = locate(node.children, id, node.id);
    if (found) return found;
  }
  return null;
}

/** Ids of all descendants (not including the block itself). */
export function getDescendantIds(block: Block): string[] {
  const ids: string[] = [];
  for (const child of block.children) {
    ids.push(child.id);
    ids.push(...getDescendantIds(child));
  }
  return ids;
}

export function insertBlock(
  tree: Block[],
  block: Block,
  parentId: string | null,
  index: number
): Block[] {
  if (parentId === null) {
    const next = [...tree];
    next.splice(clamp(index, 0, next.length), 0, block);
    return next;
  }
  return tree.map((node) => {
    if (node.id === parentId) {
      const children = [...node.children];
      children.splice(clamp(index, 0, children.length), 0, block);
      return { ...node, children };
    }
    if (node.children.length) {
      return { ...node, children: insertBlock(node.children, block, parentId, index) };
    }
    return node;
  });
}

export function removeBlock(
  tree: Block[],
  id: string
): { tree: Block[]; removed: Block | null } {
  let removed: Block | null = null;
  const rec = (nodes: Block[]): Block[] => {
    const out: Block[] = [];
    for (const n of nodes) {
      if (n.id === id) {
        removed = n;
        continue;
      }
      out.push(n.children.length ? { ...n, children: rec(n.children) } : n);
    }
    return out;
  };
  const next = rec(tree);
  return { tree: next, removed };
}

/**
 * Move a block to a new parent/index. `index` is interpreted against the
 * CURRENT tree (i.e. the drop-slot index the UI computed). When moving within
 * the same parent to a later slot, the index is adjusted for the removal.
 */
export function moveBlock(
  tree: Block[],
  id: string,
  parentId: string | null,
  index: number
): Block[] {
  // Disallow dropping a block into itself or any descendant.
  const block = findBlockById(tree, id);
  if (!block) return tree;
  if (parentId !== null) {
    if (parentId === id) return tree;
    if (getDescendantIds(block).includes(parentId)) return tree;
  }

  const before = locate(tree, id);
  const { tree: without, removed } = removeBlock(tree, id);
  if (!removed) return tree;

  let target = index;
  if (before && before.parentId === parentId && before.index < index) {
    target = index - 1;
  }
  return insertBlock(without, removed, parentId, target);
}

function mapBlock(
  tree: Block[],
  id: string,
  fn: (b: Block) => Block
): Block[] {
  return tree.map((node) => {
    if (node.id === id) return fn(node);
    if (node.children.length) {
      return { ...node, children: mapBlock(node.children, id, fn) };
    }
    return node;
  });
}

/** Set a (possibly dotted) prop path immutably, e.g. "items.0.title". */
function setByPath(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const child = cur[k];
    cur[k] = Array.isArray(child) ? [...child] : { ...(child ?? {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return root;
}

export function updateBlockProp(
  tree: Block[],
  id: string,
  key: string,
  value: any
): Block[] {
  return mapBlock(tree, id, (b) => ({
    ...b,
    props: setByPath(b.props, key, value),
  }));
}

export function updateBlockProps(
  tree: Block[],
  id: string,
  partial: Record<string, any>
): Block[] {
  return mapBlock(tree, id, (b) => ({ ...b, props: { ...b.props, ...partial } }));
}

export function updateBlockStyle(
  tree: Block[],
  id: string,
  viewport: Viewport,
  key: keyof StyleProps,
  value: string
): Block[] {
  return mapBlock(tree, id, (b) => {
    const vp: StyleProps = { ...(b.styles[viewport] ?? {}) };
    if (value === "" || value == null) {
      delete vp[key];
    } else {
      (vp as any)[key] = value;
    }
    const styles: ResponsiveStyles = { ...b.styles, [viewport]: vp };
    return { ...b, styles };
  });
}

/** Replace a block's entire responsive style set (used by "paste styles"). */
export function setBlockStyles(
  tree: Block[],
  id: string,
  styles: ResponsiveStyles
): Block[] {
  return mapBlock(tree, id, (b) => ({
    ...b,
    styles: JSON.parse(JSON.stringify(styles ?? {})),
  }));
}

/** Replace the node with `id` by zero or more `nodes` (immutably). */
export function replaceNode(tree: Block[], id: string, nodes: Block[]): Block[] {
  const out: Block[] = [];
  for (const n of tree) {
    if (n.id === id) {
      out.push(...nodes);
      continue;
    }
    out.push(n.children.length ? { ...n, children: replaceNode(n.children, id, nodes) } : n);
  }
  return out;
}

export function cloneWithNewIds(block: Block): Block {
  return {
    id: uid(),
    type: block.type,
    props: JSON.parse(JSON.stringify(block.props ?? {})),
    styles: JSON.parse(JSON.stringify(block.styles ?? {})),
    children: block.children.map(cloneWithNewIds),
  };
}

export function duplicateBlock(tree: Block[], id: string): Block[] {
  const loc = locate(tree, id);
  const orig = findBlockById(tree, id);
  if (!orig || !loc) return tree;
  const clone = cloneWithNewIds(orig);
  return insertBlock(tree, clone, loc.parentId, loc.index + 1);
}

/** Whether a child type may be dropped into a parent of the given type. */
export function canDrop(parentType: string | null, childType: string): boolean {
  switch (parentType) {
    case null:
    case "root":
    case "section":
      return childType !== "column";
    case "columns":
      return childType === "column";
    case "column":
      return childType !== "column" && childType !== "section";
    default:
      return false; // leaf blocks accept no children
  }
}
