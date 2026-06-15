"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";

export function UnsavedModal({
  open,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                <TriangleAlert size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-zinc-900">Unsaved changes</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  You have unsaved changes on this page. Save them before leaving?
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={onDiscard}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Discard
              </button>
              <button
                onClick={onSave}
                className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
              >
                Save &amp; continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
