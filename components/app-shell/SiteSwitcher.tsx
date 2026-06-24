"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import { useDismissOnOutsideClick } from "@/lib/hooks/use-dismiss";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SiteForm } from "@/components/setup/SiteForm";
import type { SiteDraft } from "@/components/setup/types";
import { siteInitial, type SiteOption } from "./SiteSwitcher.helpers";

export function SiteSwitcher({
  collapsed,
  sites,
  activeSiteId,
}: {
  collapsed: boolean;
  sites: SiteOption[];
  activeSiteId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const active = sites.find((s) => s.id === activeSiteId) ?? sites[0];

  useDismissOnOutsideClick(open, () => setOpen(false));

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await api.post(endpoints.sites.switch, { id }).catch(() => {});
    router.refresh();
    setBusy(false);
    setOpen(false);
  }

  async function createSite() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(endpoints.sites.list, draft);
      if (data?.id) await api.post(endpoints.sites.switch, { id: data.id }).catch(() => {});
      setCreating(false);
      setDraft({ name: "", logoUrl: "", faviconUrl: "" });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
          {siteInitial(active?.name)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full px-2 pb-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-[#e8eaed] bg-white px-2.5 py-2 text-left hover:border-[#d6dae0]"
      >
        <Globe size={15} className="shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#111827]">
          {active?.name ?? "No site"}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-[#9aa1ac]" />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl border border-[#e8eaed] bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#aeb4bd]">
            Sites
          </p>
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => switchTo(s.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
              {s.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-[#f1f3f5]" />
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Plus size={15} /> New site
          </button>
        </div>
      )}

      {creating && (
        <Modal onClose={() => setCreating(false)} className="max-w-md p-5">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Create a new site</h2>
            <SiteForm value={draft} onChange={setDraft} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" isDisabled={busy} onPress={() => setCreating(false)}>
                Cancel
              </Button>
              <Button isDisabled={busy || !draft.name.trim()} onPress={() => void createSite()}>
                {busy ? "Creating…" : "Create site"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
