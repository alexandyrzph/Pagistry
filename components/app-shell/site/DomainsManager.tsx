"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Copy, Check, Trash2, RefreshCw, Globe } from "lucide-react";
import { useConfirm, useAlert } from "@/components/ui/dialog-provider";
import { Button, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

type DnsRecord = { record: string; type: string; value: string };
type Domain = {
  id: string;
  hostname: string;
  status: "PENDING" | "VERIFYING" | "ACTIVE" | "ERROR";
  isPrimary: boolean;
  verifiedAt: string | null;
  lastError: string | null;
  dns: { ownership: DnsRecord; routing: DnsRecord };
};

const STATUS: Record<Domain["status"], { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-zinc-100 text-zinc-600" },
  VERIFYING: { label: "Verifying…", className: "bg-amber-100 text-amber-700" },
  ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  ERROR: { label: "Needs attention", className: "bg-red-100 text-red-700" },
};

export function DomainsManager({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = () =>
    api
      .get(endpoints.domains.list)
      .then((r) => r.data)
      .then((d) => Array.isArray(d) && setDomains(d));

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = hostname.trim();
    if (!value) return;
    setAdding(true);
    setAddErr("");
    try {
      await api.post(endpoints.domains.list, { hostname: value });
      setHostname("");
      await load();
    } catch (e) {
      const d = (axios.isAxiosError(e) ? e.response?.data : null) ?? {};
      setAddErr(d.error || "Could not add that domain");
    } finally {
      setAdding(false);
    }
  }

  async function verify(d: Domain) {
    setVerifyingId(d.id);
    try {
      const { data } = await api.post(endpoints.domains.verify(d.id), {});
      await load();
      if (data?.domain?.status !== "ACTIVE") {
        await alert({
          title: "Not verified yet",
          message:
            data?.domain?.lastError ||
            "We couldn't find the DNS records yet. They can take up to a few hours to propagate.",
        });
      }
    } catch {
      await alert({ title: "Couldn't verify", message: "Please try again in a moment." });
    } finally {
      setVerifyingId(null);
    }
  }

  async function remove(d: Domain) {
    const ok = await confirm({
      title: "Remove domain?",
      message: `${d.hostname} will stop pointing to this site.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(endpoints.domains.byId(d.id));
      await load();
    } catch {
      await alert({ title: "Couldn't remove domain", message: "Please try again." });
    }
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <div>
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <TextField
              className="flex-1 min-w-[14rem]"
              label="Add a custom domain"
              placeholder="store.example.com"
              value={hostname}
              onChange={setHostname}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="neutral"
              isLoading={adding}
              isDisabled={!hostname.trim()}
              leadingIcon={<Globe size={15} />}
            >
              Add domain
            </Button>
          </form>
          <p className="mt-1.5 min-h-4 text-xs text-danger-600" role="alert">
            {addErr}
          </p>
        </div>
      )}

      {domains.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center">
          <Globe size={20} className="mx-auto text-zinc-300" />
          <p className="mt-2 text-sm font-medium text-zinc-600">No custom domains yet</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {canManage
              ? "Add a domain above to serve this site from your own URL."
              : "An admin can connect a custom domain for this site."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-800">{d.hostname}</p>
                    {d.isPrimary && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                        Primary
                      </span>
                    )}
                  </div>
                  {d.status === "ERROR" && d.lastError && (
                    <p className="mt-0.5 truncate text-xs text-danger-600">{d.lastError}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[d.status].className}`}
                >
                  {STATUS[d.status].label}
                </span>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    {d.status !== "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="neutral"
                        onPress={() => verify(d)}
                        isLoading={verifyingId === d.id}
                        leadingIcon={<RefreshCw size={13} />}
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      aria-label={`Remove ${d.hostname}`}
                      variant="ghost"
                      size="icon"
                      onPress={() => remove(d)}
                      className="text-fg-subtle hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>

              {d.status !== "ACTIVE" && (
                <div className="border-t border-zinc-100 px-4 py-3">
                  <p className="mb-2 text-xs text-zinc-500">
                    Add these records at your DNS provider, then click Verify.
                  </p>
                  <div className="space-y-2">
                    <DnsRow record={d.dns.ownership} />
                    <DnsRow record={d.dns.routing} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DnsRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(record.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
      <span className="w-12 shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-600">
        {record.type}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Name</p>
        <code className="block truncate text-xs text-zinc-700">{record.record}</code>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Value</p>
        <code className="block truncate text-xs text-zinc-700">{record.value}</code>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onPress={copy}
        leadingIcon={copied ? <Check size={12} /> : <Copy size={12} />}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
