"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type WS = { id: string; name: string; slug: string; role: string };

export function WorkspaceSwitcher({
  collapsed,
  workspaces,
  activeId,
}: {
  collapsed: boolean;
  workspaces: WS[];
  activeId?: string;
}) {
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
    await api.post(endpoints.workspaces.switch, { id }).catch(() => {});
    router.refresh();
    setBusy(false);
    setOpen(false);
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr("");
    try {
      const { data: ws } = await api.post(endpoints.workspaces.list, { name: n });
      if (ws?.id) {
        await api.post(endpoints.workspaces.switch, { id: ws.id });
        router.refresh();
        setBusy(false);
        setCreating(false);
        setName("");
        setOpen(false);
      } else {
        setBusy(false);
        setErr(ws?.error || "Could not create workspace");
      }
    } catch (e) {
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      setBusy(false);
      setErr(d.error || "Could not create workspace");
    }
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? active?.name : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] border border-[#e8eaed] px-2 py-1.5 hover:bg-[#f7f8fa]",
          collapsed && "justify-center border-transparent px-1.5 hover:bg-[#f1f3f5]",
        )}
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold tracking-[0.02em] text-white">
          {initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13.5px] font-semibold leading-tight text-[#111827]">
              {active?.name}
            </span>
            <span className="block font-mono text-[11px] text-[#9aa1ac]">Free plan</span>
          </span>
        )}
        {!collapsed && <ChevronsUpDown size={15} className="text-[#9aa1ac]" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aeb4bd]">
            Workspaces
          </p>
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => switchTo(w.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#4b5563] hover:bg-[#f1f3f5]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-[10px] font-bold text-white">
                {w.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{w.name}</span>
              <span className="text-[10px] uppercase text-[#aeb4bd]">{w.role}</span>
              {w.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-[#f1f3f5]" />
          {creating ? (
            <div className="p-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Workspace name"
                className="w-full rounded-lg border border-[#d6dae0] px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  variant="neutral"
                  size="sm"
                  className="flex-1"
                  onPress={create}
                  isLoading={busy}
                >
                  Create
                </Button>
                <Button variant="ghost" size="sm" onPress={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
              {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Plus size={15} /> New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
