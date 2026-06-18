"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, TextField } from "@/components/ui";

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

  return (
    <>
      <Card title="Profile">
        <form onSubmit={saveName} className="space-y-3">
          <TextField label="Name" value={name} onChange={setName} isRequired />
          <TextField label="Email" value={email} isDisabled />
          {nameErr && <p className="text-xs text-danger-600">{nameErr}</p>}
          <Button type="submit" variant="neutral" isLoading={savingName} leadingIcon={nameOk ? <Check size={15} /> : undefined}>Save</Button>
        </form>
      </Card>
      <Card title="Password" desc="Changing your password signs out your other sessions.">
        <form onSubmit={savePw} className="space-y-3">
          <TextField aria-label="Current password" type="password" placeholder="Current password" value={cur} onChange={setCur} isRequired />
          <TextField aria-label="New password" type="password" placeholder="New password (min 8)" value={next} onChange={setNext} minLength={8} isRequired />
          {pwMsg && <p className={pwMsg.ok ? "text-xs text-emerald-600" : "text-xs text-danger-600"}>{pwMsg.text}</p>}
          <Button type="submit" variant="neutral" isLoading={pwBusy}>Update password</Button>
        </form>
      </Card>
    </>
  );
}
