"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type WS = { id: string; name: string; slug: string; role: string };

export function WorkspaceSwitcher({ collapsed, workspaces, activeId }: { collapsed: boolean; workspaces: WS[]; activeId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const initials = (active?.name || "W").trim().slice(0, 2).toUpperCase();

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await fetch("/api/workspaces/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
    setBusy(false); setOpen(false);
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
    const ws = await res.json().catch(() => ({}));
    if (res.ok && ws?.id) {
      await fetch("/api/workspaces/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ws.id }) });
      router.refresh();
      setBusy(false); setCreating(false); setName(""); setOpen(false);
    } else {
      setBusy(false); setErr(ws?.error || "Could not create workspace");
    }
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} title={collapsed ? active?.name : undefined} className={cn("flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-zinc-100", collapsed && "justify-center")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">{initials}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-zinc-900">{active?.name}</span>}
        {!collapsed && <ChevronsUpDown size={15} className="text-zinc-500" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Workspaces</p>
          {workspaces.map((w) => (
            <button key={w.id} onClick={() => switchTo(w.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white">{w.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-left">{w.name}</span>
              <span className="text-[10px] uppercase text-zinc-400">{w.role}</span>
              {w.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-100" />
          {creating ? (
            <div className="p-1.5">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Workspace name" className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" />
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={create} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : "Create"}</button>
                <button onClick={() => setCreating(false)} className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100">Cancel</button>
              </div>
              {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"><Plus size={15} /> New workspace</button>
          )}
        </div>
      )}
    </div>
  );
}
