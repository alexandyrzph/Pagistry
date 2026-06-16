"use client";

import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The one generic modal used across the app. A fade-in backdrop (click to
 * dismiss) wrapping a spring-animated dialog, with matching enter AND exit
 * transitions. Owns only the chrome — callers provide inner content and
 * size/padding via `className`.
 *
 * `open` defaults to true so parents that conditionally mount the modal can
 * omit it; parents that want the exit animation should keep the modal mounted
 * and toggle `open` instead.
 */
export function Modal({
  open = true,
  onClose,
  className,
  children,
  align = "center",
  dismissible = true,
  labelledBy,
}: {
  open?: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  align?: "center" | "top";
  dismissible?: boolean;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissible, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-[70] flex justify-center bg-zinc-900/40 p-4 backdrop-blur-sm",
            align === "center" ? "items-center" : "items-start pt-[12vh]",
          )}
          onClick={() => dismissible && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
            className={cn("w-full rounded-2xl bg-white shadow-2xl ring-1 ring-black/10", className)}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
