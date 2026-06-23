"use client";

import Link from "next/link";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, Loader2, Lock, Mail, User } from "lucide-react";

export type Mode = "login" | "signup" | "forgot" | "reset";

const ERROR_COPY: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.",
  oauth_failed: "Could not sign in with that provider. Please try again.",
  oauth_state: "Your sign-in session expired. Please try again.",
  provider_unavailable: "That sign-in method isn't available.",
  email_in_use: "An account with that email already exists — sign in with your password.",
};

export function initialError(errorCode?: string): string | null {
  return errorCode ? ERROR_COPY[errorCode] || "Something went wrong. Please try again." : null;
}

export function buildAuthPayload(
  mode: Mode,
  fields: { name: string; email: string; password: string; token?: string },
) {
  const { name, email, password, token } = fields;
  return mode === "signup"
    ? { name, email, password }
    : mode === "login"
      ? { email, password }
      : mode === "forgot"
        ? { email }
        : { token, password };
}

export function errorFromCatch(e: unknown): string {
  if (axios.isAxiosError(e) && e.response) {
    const data = (e.response.data ?? {}) as { error?: string };
    return data.error || "Something went wrong. Please try again.";
  }
  return "Network error. Please try again.";
}

function InputBox({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 shadow-xs transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-500/20">
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      {children}
    </div>
  );
}

function FieldInput({
  icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </label>
      <InputBox icon={icon}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
        />
      </InputBox>
    </div>
  );
}

export function ResetSentContent({
  resetUrl,
  copied,
  setCopied,
}: {
  resetUrl: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Check size={18} className="mt-0.5 shrink-0" />
        <p>If an account exists for that email, a reset link has been created.</p>
      </div>
      {resetUrl !== "sent" && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            No email service is configured — use this link to reset:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
            <code className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
              {resetUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(resetUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <Link
            href={resetUrl.replace(/^https?:\/\/[^/]+/, "")}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Open reset page <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </>
  );
}

export function AuthFormFields({
  mode,
  name,
  email,
  password,
  onName,
  onEmail,
  onPassword,
  error,
  pending,
  cta,
}: {
  mode: Mode;
  name: string;
  email: string;
  password: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  error: string | null;
  pending: boolean;
  cta: string;
}) {
  return (
    <>
      {mode === "signup" && (
        <FieldInput
          icon={<User size={15} />}
          label="Name"
          type="text"
          value={name}
          onChange={onName}
          placeholder="Jane Doe"
          autoFocus
        />
      )}
      {(mode === "login" || mode === "signup" || mode === "forgot") && (
        <FieldInput
          icon={<Mail size={15} />}
          label="Email"
          type="email"
          value={email}
          onChange={onEmail}
          placeholder="you@company.com"
          required
          autoFocus={mode !== "signup"}
        />
      )}
      {(mode === "login" || mode === "signup" || mode === "reset") && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Password</label>
            {mode === "login" && (
              <Link
                href="/forgot"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Forgot?
              </Link>
            )}
          </div>
          <InputBox icon={<Lock size={15} />}>
            <input
              type="password"
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              required
              minLength={8}
              placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
              autoFocus={mode === "reset"}
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
            />
          </InputBox>
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            {cta} <ArrowRight size={15} />
          </>
        )}
      </button>
    </>
  );
}

export function AuthFooter({ mode }: { mode: Mode }) {
  return (
    <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
      {mode === "login" && (
        <>
          New to Pagistry?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Create an account
          </Link>
        </>
      )}
      {mode === "signup" && (
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Sign in
          </Link>
        </>
      )}
      {(mode === "forgot" || mode === "reset") && (
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Back to sign in
        </Link>
      )}
    </p>
  );
}
