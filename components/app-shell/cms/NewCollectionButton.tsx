"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NewCollectionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New collection" }),
    });
    const c = await res.json().catch(() => ({}));
    if (res.ok && c?.id) {
      router.push(`/cms/${c.id}`);
      router.refresh();
    } else {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={create}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New collection
    </button>
  );
}
