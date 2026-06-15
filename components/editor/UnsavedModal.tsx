"use client";

import { TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";

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
    <Modal open={open} onClose={onCancel} className="max-w-sm p-5">
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
    </Modal>
  );
}
