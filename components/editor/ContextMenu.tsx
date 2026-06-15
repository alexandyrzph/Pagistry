"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Component as ComponentIcon,
  Copy,
  CornerDownRight,
  Paintbrush,
  Scissors,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { findBlockById, locate } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { useEditorActions } from "./editor-actions";

const MENU_W = 210;

export function ContextMenu() {
  const ctx = useEditorUI((s) => s.ctx);
  const closeCtx = useEditorUI((s) => s.closeCtx);
  const openInserter = useEditorUI((s) => s.openInserter);
  const actions = useEditorActions();
  const duplicate = useEditor((s) => s.duplicate);
  const copy = useEditor((s) => s.copy);
  const cut = useEditor((s) => s.cut);
  const paste = useEditor((s) => s.paste);
  const copyStyles = useEditor((s) => s.copyStyles);
  const pasteStyles = useEditor((s) => s.pasteStyles);
  const remove = useEditor((s) => s.remove);
  const moveRelative = useEditor((s) => s.moveRelative);

  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCtx();
    const onScroll = () => closeCtx();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [ctx, closeCtx]);

  if (!ctx) return null;

  const tree = useEditor.getState().tree;
  const block = findBlockById(tree, ctx.blockId);
  const loc = locate(tree, ctx.blockId);
  if (!block || !loc) return null;
  const isComponent = block.type === "component";
  const siblingCount = loc.parentId
    ? findBlockById(tree, loc.parentId)?.children.length ?? 0
    : tree.length;

  const x = Math.min(ctx.x, window.innerWidth - MENU_W - 8);
  const y = Math.min(ctx.y, window.innerHeight - 340);

  const run = (fn: () => void) => {
    fn();
    closeCtx();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onClick={closeCtx}
        onContextMenu={(e) => {
          e.preventDefault();
          closeCtx();
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="fixed z-[61] overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl ring-1 ring-black/5"
        style={{ left: x, top: y, width: MENU_W }}
      >
        <Item icon={<Copy size={14} />} label="Duplicate" shortcut="⌘D" onClick={() => run(() => duplicate(ctx.blockId))} />
        <Item icon={<Copy size={14} />} label="Copy" shortcut="⌘C" onClick={() => run(() => copy(ctx.blockId))} />
        <Item icon={<Scissors size={14} />} label="Cut" shortcut="⌘X" onClick={() => run(() => cut(ctx.blockId))} />
        <Item icon={<ClipboardPaste size={14} />} label="Paste below" shortcut="⌘V" onClick={() => run(() => paste(ctx.blockId))} />
        <Divider />
        <Item icon={<Paintbrush size={14} />} label="Copy styles" shortcut="⌘⌥C" onClick={() => run(() => copyStyles(ctx.blockId))} />
        <Item icon={<Paintbrush size={14} />} label="Paste styles" shortcut="⌘⌥V" onClick={() => run(() => pasteStyles(ctx.blockId))} />
        <Divider />
        <Item
          icon={<CornerDownRight size={14} />}
          label="Insert section below"
          onClick={() => run(() => openInserter({ parentId: loc.parentId, index: loc.index + 1 }))}
        />
        <Item
          icon={<ArrowUp size={14} />}
          label="Move up"
          disabled={loc.index === 0}
          onClick={() => run(() => moveRelative(ctx.blockId, -1))}
        />
        <Item
          icon={<ArrowDown size={14} />}
          label="Move down"
          disabled={loc.index >= siblingCount - 1}
          onClick={() => run(() => moveRelative(ctx.blockId, 1))}
        />
        {!isComponent && (
          <>
            <Divider />
            <Item
              icon={<ComponentIcon size={14} />}
              label="Save as component"
              onClick={() => run(() => actions.saveAsComponent(block))}
            />
          </>
        )}
        <Divider />
        <Item icon={<Trash2 size={14} />} label="Delete" shortcut="⌫" danger onClick={() => run(() => remove(ctx.blockId))} />
      </motion.div>
    </>
  );
}

function Item({
  icon,
  label,
  shortcut,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700 hover:bg-zinc-100"
      )}
    >
      <span className={cn("shrink-0", danger ? "text-red-500" : "text-zinc-400")}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[11px] text-zinc-400">{shortcut}</span>}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-zinc-100" />;
}
