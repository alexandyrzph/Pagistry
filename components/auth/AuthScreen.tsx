"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, Layout, Loader2, Lock, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoodleBuild, DoodleMagic, DoodleWave } from "@/components/onboarding/doodles";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your Pagecraft workspace.", cta: "Sign in" },
  signup: { title: "Create your account", sub: "Start building beautiful pages in minutes.", cta: "Create account" },
  forgot: { title: "Reset your password", sub: "We'll send you a link to set a new password.", cta: "Send reset link" },
  reset: { title: "Set a new password", sub: "Choose a strong password for your account.", cta: "Update password" },
};

const PANEL: Record<Mode, { Doodle: typeof DoodleWave; accent: string; lines: string[] }> = {
  signup: { Doodle: DoodleWave, accent: "#a5b4fc", lines: ["Drag-and-drop builder", "Generate sections with AI", "Publish in one click"] },
  login: { Doodle: DoodleBuild, accent: "#a5b4fc", lines: ["Your pages, components & CMS", "Shared team workspace", "Responsive by default"] },
  forgot: { Doodle: DoodleMagic, accent: "#c4b5fd", lines: ["Secure password reset", "Back to building in a minute"] },
  reset: { Doodle: DoodleMagic, accent: "#c4b5fd", lines: ["Almost there", "Pick something memorable"] },
};

export function AuthScreen({ mode, token, next }: { mode: Mode; token?: string; next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const c = COPY[mode];
  const panel = PANEL[mode];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload =
        mode === "signup" ? { name, email, password }
        : mode === "login" ? { email, password }
        : mode === "forgot" ? { email }
        : { token, password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      if (mode === "forgot") {
        setResetUrl(data.resetUrl || "sent");
        setPending(false);
        return;
      }
      // login / signup / reset → authenticated
      const dest = data.onboarded ? next || "/" : "/onboarding";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Brand / doodle panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur"><Layout size={18} /></span>
          <span className="text-lg font-semibold tracking-tight">Pagecraft</span>
        </div>
        <div className="relative z-10">
          <div className="mb-8 flex h-48 w-48 items-center justify-center rounded-[2rem] bg-white/95 shadow-xl ring-1 ring-white/30">
            <panel.Doodle className="h-36 w-36" />
          </div>
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">Design, publish & ship beautiful pages.</h2>
          <ul className="mt-6 space-y-2.5">
            {panel.lines.map((l) => (
              <li key={l} className="flex items-center gap-2.5 text-white/85">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20"><Check size={12} /></span>
                {l}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">© {2026} Pagecraft Studio</p>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{c.title}</h1>
            <p className="mt-1.5 text-sm text-zinc-500">{c.sub}</p>
          </div>

          <AnimatePresence mode="wait">
            {mode === "forgot" && resetUrl ? (
              <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <Check size={18} className="mt-0.5 shrink-0" />
                  <p>If an account exists for that email, a reset link has been created.</p>
                </div>
                {resetUrl !== "sent" && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">No email service is configured — use this link to reset:</p>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <code className="min-w-0 flex-1 truncate text-xs text-zinc-600">{resetUrl}</code>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(resetUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <Link href={resetUrl.replace(/^https?:\/\/[^/]+/, "")} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                      Open reset page <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {mode === "signup" && (
                  <FieldInput icon={<User size={15} />} label="Name" type="text" value={name} onChange={setName} placeholder="Jane Doe" autoFocus />
                )}
                {(mode === "login" || mode === "signup" || mode === "forgot") && (
                  <FieldInput icon={<Mail size={15} />} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required autoFocus={mode !== "signup"} />
                )}
                {(mode === "login" || mode === "signup" || mode === "reset") && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-600">Password</label>
                      {mode === "login" && (
                        <Link href="/forgot" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Forgot?</Link>
                      )}
                    </div>
                    <InputBox icon={<Lock size={15} />}>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                        placeholder={mode === "login" ? "Your password" : "At least 8 characters"} autoFocus={mode === "reset"}
                        className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
                    </InputBox>
                  </div>
                )}

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</motion.p>
                )}

                <button type="submit" disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60">
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <>{c.cta} <ArrowRight size={15} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "login" && <>New to Pagecraft? <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">Create an account</Link></>}
            {mode === "signup" && <>Already have an account? <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Sign in</Link></>}
            {(mode === "forgot" || mode === "reset") && <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Back to sign in</Link>}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function InputBox({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 shadow-xs transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
      <span className="text-zinc-400">{icon}</span>
      {children}
    </div>
  );
}

function FieldInput({ icon, label, type, value, onChange, placeholder, required, autoFocus }: {
  icon: React.ReactNode; label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      <InputBox icon={icon}>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoFocus={autoFocus}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
      </InputBox>
    </div>
  );
}
