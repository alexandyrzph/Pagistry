"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFloatingPanel } from "./inspector/useFloatingPanel";
import { InspectorContent } from "./inspector/InspectorContent";

export function FloatingInspector() {
  const {
    block,
    show,
    style,
    width,
    dragging,
    resizing,
    docked,
    dockHint,
    handlePointerDown,
    handleResizeDown,
    toggleDock,
  } = useFloatingPanel();

  return (
    <>
      {/* dock-zone preview while dragging toward the right edge */}
      {dragging && dockHint && (
        <div
          className="pointer-events-none fixed z-[39] border-l-2 border-indigo-400 bg-indigo-500/10"
          style={{ top: 56, bottom: 0, right: 0, width }}
        />
      )}
      <AnimatePresence>
        {show && block && (
          <motion.aside
            key={block.id}
            initial={{ opacity: 0, scale: 0.97, x: docked ? 8 : -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={dragging || resizing ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34 }}
            style={style}
            className={cn(
              "z-40 flex flex-col overflow-hidden border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5",
              docked ? "border-l rounded-none" : "rounded-2xl border",
              (dragging || resizing) && "ring-indigo-300/60 select-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* resize handle on the left edge */}
            <div
              onPointerDown={handleResizeDown}
              className="group absolute left-0 top-0 z-10 h-full w-1.5 cursor-ew-resize"
              title="Drag to resize"
            >
              <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-indigo-400" />
            </div>
            <InspectorContent
              block={block}
              onHandlePointerDown={handlePointerDown}
              dragging={dragging}
              docked={docked}
              onToggleDock={toggleDock}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
