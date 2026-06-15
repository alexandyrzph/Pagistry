"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Trash2 } from "lucide-react";

type WS = { id: string; name: string; slug: string };
type Member = { membershipId: string; userId: string; name: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; token: string; expiresAt: string };
const ROLES = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const input = "rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

export function SettingsClient({ workspace, role }: { workspace: WS; role: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "members" | "invites" | "danger">("general");
  const tabs: Array<"general" | "members" | "invites" | "danger"> =
    role === "OWNER" ? ["general", "members", "invites", "danger"] : ["general", "members", "invites"];
  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-indigo-600 text-indigo-700" : "text-zinc-500 hover:text-zinc-800"}`}>{t}</button>
        ))}
      </div>
      <div className="py-6">
        {tab === "general" && <General workspace={workspace} onSaved={() => router.refresh()} />}
        {tab === "members" && <Members />}
        {tab === "invites" && <Invites />}
        {tab === "danger" && <Danger workspace={workspace} role={role} />}
      </div>
    </>
  );
}

function General({ workspace, onSaved }: { workspace: WS; onSaved: () => void }) {
  const [name, setName] = useState(workspace.name);
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setOk(false); setErr("");
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setOk(true); onSaved(); setTimeout(() => setOk(false), 1500); }
    else { const d = res ? await res.json().catch(() => ({})) : {}; setErr(d.error || "Could not save"); }
  }
  return (
    <form onSubmit={save} className="max-w-sm space-y-3">
      <label htmlFor="ws-name" className="block text-xs font-medium text-zinc-600">Workspace name</label>
      <input id="ws-name" className={input + " w-full"} value={name} onChange={(e) => setName(e.target.value)} required />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : ok ? <Check size={15} /> : null} Save</button>
    </form>
  );
}

function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const load = () => fetch("/api/workspaces/members").then((r) => r.json()).then((d) => Array.isArray(d) && setMembers(d));
  useEffect(() => { load(); }, []);
  async function changeRole(m: Member, role: string) {
    const res = await fetch("/api/workspaces/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ membershipId: m.membershipId, role }) }).catch(() => null);
    if (res && !res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Could not change role"); }
    load();
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.email}?`)) return;
    const res = await fetch(`/api/workspaces/members?membershipId=${m.membershipId}`, { method: "DELETE" }).catch(() => null);
    if (res && !res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Could not remove member"); }
    load();
  }
  return (
    <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
      {members.map((m) => (
        <div key={m.membershipId} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">{(m.name || m.email).slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-800">{m.name || "—"}</p><p className="truncate text-xs text-zinc-400">{m.email}</p></div>
          <select aria-label={`Role for ${m.email}`} value={m.role} onChange={(e) => changeRole(m, e.target.value)} className={input}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <button aria-label={`Remove ${m.email}`} onClick={() => remove(m)} className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState(""); const [role, setRole] = useState("EDITOR");
  const [busy, setBusy] = useState(false); const [link, setLink] = useState(""); const [copied, setCopied] = useState(false); const [err, setErr] = useState("");
  const load = () => fetch("/api/workspaces/invites").then((r) => r.json()).then((d) => Array.isArray(d) && setInvites(d));
  useEffect(() => { load(); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setLink("");
    const res = await fetch("/api/workspaces/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setLink(d.inviteUrl); setEmail(""); load(); } else setErr(d.error || "Failed");
  }
  async function revoke(id: string) { const res = await fetch(`/api/workspaces/invites?id=${id}`, { method: "DELETE" }).catch(() => null); if (res && !res.ok) alert("Could not revoke invite"); load(); }
  return (
    <div className="space-y-5">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="flex-1"><label className="mb-1 block text-xs font-medium text-zinc-600">Invite by email</label><input className={input + " w-full"} type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>{["VIEWER", "EDITOR", "ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} Invite</button>
      </form>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {link && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1.5 text-xs font-medium text-emerald-800">No email service configured — share this invite link:</p>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2">
            <code className="min-w-0 flex-1 truncate text-xs text-zinc-600">{link}</code>
            <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-700">{i.email}</p><p className="text-xs text-zinc-400">{i.role} · pending</p></div><button onClick={() => revoke(i.id)} className="text-xs font-medium text-red-500 hover:underline">Revoke</button></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Danger({ workspace, role }: { workspace: WS; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function del() {
    if (!confirm(`Delete "${workspace.name}"? This permanently removes its pages, CMS, and assets.`)) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { router.push("/"); router.refresh(); } else { setErr(d.error || "Failed"); setBusy(false); }
  }
  if (role !== "OWNER") return <p className="text-sm text-zinc-500">Only the workspace owner can delete the workspace.</p>;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h3 className="text-sm font-semibold text-red-800">Delete this workspace</h3>
      <p className="mt-1 text-xs text-red-600">Permanent. You must have another workspace to switch to.</p>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      <button onClick={del} disabled={busy} className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete workspace</button>
    </div>
  );
}
