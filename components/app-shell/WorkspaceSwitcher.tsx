"use client";

import { useState } from "react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import {
  type WS,
  WorkspaceListItem,
  WorkspaceTrigger,
  workspaceInitials,
} from "./WorkspaceSwitcher.helpers";
import { CreateWorkspaceModal } from "@/components/setup/CreateWorkspaceModal";

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
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const initials = workspaceInitials(active?.name);

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    await api.post(endpoints.workspaces.switch, { id }).catch(() => {});
    router.refresh();
    setOpen(false);
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <WorkspaceTrigger
        collapsed={collapsed}
        name={active?.name}
        initials={initials}
        onToggle={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aeb4bd]">
            Workspaces
          </p>
          {workspaces.map((w) => (
            <WorkspaceListItem
              key={w.id}
              ws={w}
              isActive={w.id === active?.id}
              onSelect={() => switchTo(w.id)}
            />
          ))}
          <div className="my-1 border-t border-[#f1f3f5]" />
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Plus size={15} /> New workspace
          </button>
        </div>
      )}
      <CreateWorkspaceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
