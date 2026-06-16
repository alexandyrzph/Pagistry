"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Blocks, Check, Copy, Loader2, Lock, Mail, User } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AuthBackground } from "@/components/auth/AuthBackground";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your Pagecraft workspace.", cta: "Sign in" },
  signup: { title: "Create your account", sub: "Start building beautiful pages in minutes.", cta: "Create account" },
  forgot: { title: "Reset your password", sub: "We'll send you a link to set a new password.", cta: "Send reset link" },
  reset: { title: "Set a new password", sub: "Choose a strong password for your account.", cta: "Update password" },
};

const ERROR_COPY: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.",
  oauth_failed: "Could not sign in with that provider. Please try again.",
  oauth_state: "Your sign-in session expired. Please try again.",
  provider_unavailable: "That sign-in method isn't available.",
  email_in_use: "An account with that email already exists — sign in with your password.",
};

export function AuthScreen({ mode, token, next, errorCode }: { mode: Mode; token?: string; next?: string; errorCode?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERROR_COPY[errorCode] || "Something went wrong. Please try again." : null);
  const [pending, setPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const c = COPY[mode];

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
      const dest = data.onboarded ? next || "/" : "/onboarding";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10">
      <AuthBackground />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-zinc-900/90 dark:ring-white/10 sm:p-9"
      >
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"><Blocks size={18} /></span>
          <span className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Pagecraft</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{c.title}</h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{c.sub}</p>
        </div>

        {(mode === "login" || mode === "signup") && <div className="mb-5"><OAuthButtons next={next} /></div>}

        <AnimatePresence mode="wait">
          {mode === "forgot" && resetUrl ? (
            <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Check size={18} className="mt-0.5 shrink-0" />
                <p>If an account exists for that email, a reset link has been created.</p>
              </div>
              {resetUrl !== "sent" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">No email service is configured — use this link to reset:</p>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <code className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{resetUrl}</code>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(resetUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <Link href={resetUrl.replace(/^https?:\/\/[^/]+/, "")} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
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
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Password</label>
                    {mode === "login" && (
                      <Link href="/forgot" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Forgot?</Link>
                    )}
                  </div>
                  <InputBox icon={<Lock size={15} />}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                      placeholder={mode === "login" ? "Your password" : "At least 8 characters"} autoFocus={mode === "reset"}
                      className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500" />
                  </InputBox>
                </div>
              )}

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</motion.p>
              )}

              <button type="submit" disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <>{c.cta} <ArrowRight size={15} /></>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "login" && <>New to Pagecraft? <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Create an account</Link></>}
          {mode === "signup" && <>Already have an account? <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Sign in</Link></>}
          {(mode === "forgot" || mode === "reset") && <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Back to sign in</Link>}
        </p>
      </motion.div>
    </div>
  );
}

function InputBox({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 shadow-xs transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-500/20">
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      {children}
    </div>
  );
}

function FieldInput({ icon, label, type, value, onChange, placeholder, required, autoFocus }: {
  icon: React.ReactNode; label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
      <InputBox icon={icon}>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} autoFocus={autoFocus}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500" />
      </InputBox>
    </div>
  );
}
