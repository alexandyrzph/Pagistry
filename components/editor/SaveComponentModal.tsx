"use client";

import { useEffect, useRef, useState } from "react";
import { Component as ComponentIcon, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

export function SaveComponentModal({
  open,
  defaultName,
  onCancel,
  onSave,
}: {
  open: boolean;
  defaultName: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSaving(false);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, defaultName]);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onSave(name.trim());
  }

  return (
    <Modal open={open} onClose={onCancel} className="max-w-sm p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <ComponentIcon size={18} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold tracking-tight text-zinc-900">Save as component</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Reuse this across pages. Editing the component updates every instance.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[11px] font-medium text-zinc-500">Component name</label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. Site header"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save component
        </button>
      </div>
    </Modal>
  );
}
