"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AccountForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameOk, setNameOk] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [cur, setCur] = useState(""); const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false); const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setSavingName(true); setNameOk(false); setNameErr("");
    const res = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    setSavingName(false);
    if (res && res.ok) { setNameOk(true); router.refresh(); setTimeout(() => setNameOk(false), 1500); }
    else { const d = res ? await res.json().catch(() => ({})) : {}; setNameErr(d.error || "Could not save"); }
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault(); setPwBusy(true); setPwMsg(null);
    const res = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current: cur, next }) });
    const d = await res.json().catch(() => ({}));
    setPwBusy(false);
    setPwMsg(res.ok ? { ok: true, text: "Password updated. Other sessions were signed out." } : { ok: false, text: d.error || "Failed" });
    if (res.ok) { setCur(""); setNext(""); }
  }

  const input = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  return (
    <>
      <Card title="Profile">
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label htmlFor="acct-name" className="mb-1 block text-xs font-medium text-zinc-600">Name</label>
            <input id="acct-name" className={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="acct-email" className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
            <input id="acct-email" className={input + " bg-zinc-50 text-zinc-400"} value={email} disabled />
          </div>
          {nameErr && <p className="text-xs text-red-600">{nameErr}</p>}
          <button disabled={savingName} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingName ? <Loader2 size={15} className="animate-spin" /> : nameOk ? <Check size={15} /> : null} Save</button>
        </form>
      </Card>
      <Card title="Password" desc="Changing your password signs out your other sessions.">
        <form onSubmit={savePw} className="space-y-3">
          <input aria-label="Current password" className={input} type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} required />
          <input aria-label="New password" className={input} type="password" placeholder="New password (min 8)" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          {pwMsg && <p className={pwMsg.ok ? "text-xs text-emerald-600" : "text-xs text-red-600"}>{pwMsg.text}</p>}
          <button disabled={pwBusy} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">{pwBusy && <Loader2 size={15} className="animate-spin" />} Update password</button>
        </form>
      </Card>
    </>
  );
}
