"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Clipboard, Copy, Layers, Trash2, X } from "lucide-react";
import { getDefinition } from "@/lib/registry";
import { pathToBlock } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { useComponents } from "./components-context";

// Bottom-of-canvas selection HUD:
//  • one block selected  → ancestor breadcrumb (click a crumb to select it)
//  • many blocks selected → bulk-action bar (duplicate / paste styles / delete)
export function SelectionBreadcrumb() {
  const selectedId = useEditor((s) => s.selectedId);
  const selectedIds = useEditor((s) => s.selectedIds);
  const tree = useEditor((s) => s.tree);
  const previewMode = useEditor((s) => s.previewMode);
  const select = useEditor((s) => s.select);
  const duplicateSelected = useEditor((s) => s.duplicateSelected);
  const removeSelected = useEditor((s) => s.removeSelected);
  const pasteStyles = useEditor((s) => s.pasteStyles);
  const components = useComponents();

  const domOpen = useEditorUI((s) => s.domTree);
  const multi = selectedIds.length > 1;
  const path = selectedId ? pathToBlock(tree, selectedId) : null;
  const show = !previewMode && !domOpen && (multi || !!path);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {show && multi ? (
          <motion.div
            key="multi"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            role="toolbar"
            aria-label="Selection actions"
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-zinc-900 py-1.5 pl-3 pr-1.5 text-white shadow-2xl ring-1 ring-black/10"
          >
            <span className="flex items-center gap-1.5 pr-1 text-[13px] font-semibold">
              <Layers size={14} className="text-indigo-300" />
              {selectedIds.length} selected
            </span>
            <BarBtn icon={<Clipboard size={14} />} label="Paste styles" onClick={() => pasteStyles(selectedId ?? selectedIds[0])} />
            <BarBtn icon={<Copy size={14} />} label="Duplicate" onClick={duplicateSelected} />
            <BarBtn icon={<Trash2 size={14} />} label="Delete" danger onClick={removeSelected} />
            <span className="mx-0.5 h-5 w-px bg-white/15" />
            <BarBtn icon={<X size={14} />} label="Clear" onClick={() => select(null)} />
          </motion.div>
        ) : show && path ? (
          <motion.nav
            key="crumb"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            aria-label="Selected element path"
            className="pointer-events-auto flex max-w-[80vw] items-center gap-0.5 overflow-x-auto rounded-full bg-white/95 px-2 py-1 text-[12px] shadow-xl ring-1 ring-black/5 backdrop-blur"
          >
            {path.map((b, i) => {
              const isLast = i === path.length - 1;
              const def = getDefinition(b.type);
              const Icon = def?.icon;
              const label =
                b.type === "component"
                  ? components.map[b.props?.componentId]?.name ?? "Component"
                  : def?.label ?? b.type;
              return (
                <span key={b.id} className="flex shrink-0 items-center">
                  {i > 0 && <ChevronRight size={13} className="mx-0.5 text-zinc-300" />}
                  <button
                    type="button"
                    onClick={() => select(b.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-1 font-medium transition-colors",
                      isLast
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                    )}
                  >
                    {Icon && <Icon size={12} />}
                    {label}
                  </button>
                </span>
              );
            })}
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BarBtn({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-white/15",
        danger && "hover:bg-red-500/20 hover:text-red-300"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
