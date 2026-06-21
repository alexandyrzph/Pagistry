"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Check } from "lucide-react";
import { Button, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { DomainsManager } from "./DomainsManager";

type Site = { id: string; name: string; handle: string };
type Tab = "general" | "domains";

export function SiteSettingsClient({ site, canManage }: { site: Site; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("general");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "general", label: "General" },
    { id: "domains", label: "Domains" },
  ];
  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium ${tab === t.id ? "border-b-2 border-brand-600 text-brand-700" : "text-fg-muted hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="py-6">
        {tab === "general" && <General site={site} canManage={canManage} />}
        {tab === "domains" && <DomainsManager canManage={canManage} />}
      </div>
    </>
  );
}

function General({ site, canManage }: { site: Site; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(site.name);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    setOk(false);
    setErr("");
    try {
      await api.patch(endpoints.sites.byId(site.id), { name: value });
      setBusy(false);
      setOk(true);
      router.refresh();
      setTimeout(() => setOk(false), 1500);
    } catch (e) {
      setBusy(false);
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      setErr(d.error || "Could not save");
    }
  }

  if (!canManage) {
    return (
      <dl className="max-w-sm space-y-4 text-sm">
        <div>
          <dt className="text-fg-muted">Site name</dt>
          <dd className="mt-0.5 font-medium text-fg">{site.name}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Handle</dt>
          <dd className="mt-0.5 font-medium text-fg">{site.handle}</dd>
        </div>
      </dl>
    );
  }

  return (
    <form onSubmit={save} className="max-w-sm space-y-4">
      <TextField label="Site name" value={name} onChange={setName} />
      <div>
        <p className="text-sm font-medium text-fg">Handle</p>
        <p className="mt-1.5 rounded-control border border-border bg-zinc-50 px-3 py-2 text-sm text-fg-muted">
          {site.handle}
        </p>
      </div>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Button
        type="submit"
        variant="neutral"
        isLoading={busy}
        isDisabled={!name.trim()}
        leadingIcon={ok ? <Check size={15} /> : undefined}
      >
        Save
      </Button>
    </form>
  );
}
