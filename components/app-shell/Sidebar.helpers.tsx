"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SiteSwitcher } from "./SiteSwitcher";
import { SidebarProfile } from "./SidebarProfile";
import { SettingsMenu } from "./SettingsMenu";

type WS = { id: string; name: string; slug: string; role: string };
type Site = { id: string; name: string; handle: string };

export function isPaletteShortcut(e: KeyboardEvent) {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}

function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function SidebarRail({
  collapsed,
  workspaces,
  active,
  user,
  pathname,
  onSearch,
  sites,
  activeSiteId,
}: {
  collapsed: boolean;
  workspaces: WS[];
  active: WS | undefined;
  user: { name: string; email: string };
  pathname: string;
  onSearch: () => void;
  sites: Site[];
  activeSiteId?: string;
}) {
  const w = collapsed ? "w-[68px]" : "w-64";
  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-[#e8eaed] bg-white text-[#4b5563] transition-[width] duration-200",
        w,
      )}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <WorkspaceSwitcher collapsed={collapsed} workspaces={workspaces} activeId={active?.id} />
      </div>
      <SiteSwitcher collapsed={collapsed} sites={sites} activeSiteId={activeSiteId} />
      <div className="px-4 pb-2">
        <button
          onClick={onSearch}
          title={collapsed ? "Search (⌘K)" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[9px] bg-[#f1f3f5] px-2.5 py-2 text-sm text-[#9aa1ac] transition-colors hover:bg-[#e9ecef]",
            collapsed && "justify-center bg-transparent hover:bg-[#f1f3f5]",
          )}
        >
          <Search size={16} />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && (
            <kbd className="rounded-[5px] border border-[#d6dae0] bg-[#fbfbfc] px-1.5 py-0.5 font-mono text-[10.5px] text-[#9aa1ac]">
              ⌘K
            </kbd>
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#aeb4bd]">
                {g.title}
              </p>
            )}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const act = isNavActive(pathname, it.href);
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
                    <Icon
                      size={17}
                      strokeWidth={act ? 2.1 : 1.8}
                      className={cn(act && "text-indigo-600")}
                    />
                    {!collapsed && it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-[#e8eaed] px-4 py-3">
        <SettingsMenu collapsed={collapsed} />
        <SidebarProfile collapsed={collapsed} user={user} />
      </div>
    </div>
  );
}
