"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared modal shell: a fade-in backdrop (click to dismiss) wrapping a
 * spring-animated white dialog. Owns ONLY the chrome — callers provide the
 * inner content and size/padding via `className`. `open` defaults to true so
 * parents that conditionally mount the modal can omit it.
 */
export function Modal({
  open = true,
  onClose,
  className,
  children,
}: {
  open?: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
            className={cn("w-full rounded-2xl bg-white shadow-2xl ring-1 ring-black/10", className)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
