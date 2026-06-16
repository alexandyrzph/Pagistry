"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCog, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarProfile({ collapsed, user }: { collapsed: boolean; user: { name: string; email: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  const initials = (user.name || user.email).trim().slice(0, 2).toUpperCase();

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function logout() {
    setOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login"); router.refresh();
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} title={collapsed ? (user.name || user.email) : undefined} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-100", collapsed && "justify-center")}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">{initials}</span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left text-sm text-zinc-700">{user.name || user.email}</span>}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl">
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-zinc-800">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-zinc-400">{user.email}</p>
          </div>
          <Link href="/account" className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100"><UserCog size={15} className="text-zinc-400" /> Account settings</Link>
          <button onClick={logout} disabled={out} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-60">{out ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} className="text-zinc-400" />} Sign out</button>
        </div>
      )}
    </div>
  );
}
