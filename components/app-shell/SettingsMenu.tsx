"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, SlidersHorizontal, Building2, ChevronRight } from "lucide-react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Workspace settings", icon: Building2 },
  { href: "/site-settings", label: "Website settings", icon: SlidersHorizontal },
] as const;

export function SettingsMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useDismissOnOutsideClick(open, () => setOpen(false));

  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const active = ITEMS.some((it) => matches(it.href));

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? "Settings" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-medium text-[#4b5563] transition-colors hover:bg-black/[0.03] hover:text-[#111827]",
          (active || open) &&
            "border border-[#e8eaed] bg-white font-semibold text-[#111827] shadow-xs",
          collapsed && "justify-center",
        )}
      >
        <Settings size={17} />
        {!collapsed && <span className="flex-1 text-left">Settings</span>}
        {!collapsed && (
          <ChevronRight
            size={14}
            className={cn("text-[#aeb4bd] transition-transform", open && "-rotate-90")}
          />
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#4b5563] hover:bg-[#f1f3f5]",
                matches(href) && "bg-[#f1f3f5] font-semibold text-[#111827]",
              )}
            >
              <Icon size={16} className="shrink-0 text-[#9aa1ac]" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
