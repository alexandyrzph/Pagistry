"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Fixed-overlay animated dropdown. Renders a full-screen click-catcher (closes on
 * click) plus a spring-animated panel. Callers supply the trigger button and pass
 * position/width/padding/rounding via `className`. Mirrors <Modal> for popovers.
 */
export function Popover({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className={cn(
              "absolute z-50 border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5",
              className,
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
