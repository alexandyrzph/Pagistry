"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, Menu, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";
import { setSidebarCookie } from "./SidebarToggleCookie";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SidebarProfile } from "./SidebarProfile";
import { CommandPalette } from "./CommandPalette";

type WS = { id: string; name: string; slug: string; role: string };

export function Sidebar({
  collapsed: initialCollapsed, workspaces, activeWorkspaceId, role, user,
}: {
  collapsed: boolean; workspaces: WS[]; activeWorkspaceId: string; role: string;
  user: { name: string; email: string };
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => { setCollapsed((c) => { setSidebarCookie(!c); return !c; }); };
  const w = collapsed ? "w-[68px]" : "w-64";
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  const rail = (
    <div className={cn("flex h-full flex-col border-r border-[#e8eaed] bg-white text-[#4b5563] transition-[width] duration-200", w)}>
      <div className="flex items-center gap-2 px-3 py-3.5">
        <WorkspaceSwitcher collapsed={collapsed} workspaces={workspaces} activeId={active?.id} />
      </div>
      <div className="px-3 pb-2">
        <button
          onClick={() => setPaletteOpen(true)}
          title={collapsed ? "Search (⌘K)" : undefined}
          className={cn("flex w-full items-center gap-2.5 rounded-[9px] bg-[#f1f3f5] px-2.5 py-2 text-sm text-[#9aa1ac] transition-colors hover:bg-[#e9ecef]", collapsed && "justify-center bg-transparent hover:bg-[#f1f3f5]")}
        >
          <Search size={16} />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && <kbd className="rounded-[5px] border border-[#d6dae0] bg-[#fbfbfc] px-1.5 py-0.5 font-mono text-[10.5px] text-[#9aa1ac]">⌘K</kbd>}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            {!collapsed && <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#aeb4bd]">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const act = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={collapsed ? it.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors",
                      act
                        ? "bg-indigo-50 font-semibold text-indigo-600"
                        : "font-medium text-[#4b5563] hover:bg-black/[0.03] hover:text-[#111827]",
                      collapsed && "justify-center",
                    )}
                  >
                    <Icon size={17} strokeWidth={act ? 2.1 : 1.8} className={cn(act && "text-indigo-600")} />
                    {!collapsed && it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-[#e8eaed] p-3">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-medium text-[#4b5563] transition-colors hover:bg-black/[0.03] hover:text-[#111827]",
            isActive("/settings") && "border border-[#e8eaed] bg-white font-semibold text-[#111827] shadow-xs",
            collapsed && "justify-center",
          )}
        >
          <Settings size={17} />{!collapsed && "Settings"}
        </Link>
        <SidebarProfile collapsed={collapsed} user={user} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen shrink-0 md:block">
        <div className="relative h-full">
          {rail}
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#e8eaed] bg-white text-[#9aa1ac] shadow-sm transition-colors hover:border-[#d6dae0] hover:text-[#111827]"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2.5 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 hover:bg-[#f1f3f5]"><Menu size={20} /></button>
        <span className="text-sm font-semibold text-[#111827]">{active?.name}</span>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <motion.div className="absolute left-0 top-0 h-full" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 400, damping: 36 }}>
              <div className="relative h-full">{rail}<button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 text-[#9aa1ac]"><X size={18} /></button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
