"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Blocks } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import {
  AuthFooter,
  AuthFormFields,
  ResetSentContent,
  buildAuthPayload,
  errorFromCatch,
  initialError,
  type Mode,
} from "@/components/auth/AuthScreen.helpers";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your Pagistry workspace.", cta: "Sign in" },
  signup: {
    title: "Create your account",
    sub: "Start building beautiful pages in minutes.",
    cta: "Create account",
  },
  forgot: {
    title: "Reset your password",
    sub: "We'll send you a link to set a new password.",
    cta: "Send reset link",
  },
  reset: {
    title: "Set a new password",
    sub: "Choose a strong password for your account.",
    cta: "Update password",
  },
};

export function AuthScreen({
  mode,
  token,
  next,
  errorCode,
}: {
  mode: Mode;
  token?: string;
  next?: string;
  errorCode?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError(errorCode));
  const [pending, setPending] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const c = COPY[mode];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = buildAuthPayload(mode, { name, email, password, token });
      const { data } = await api.post(endpoints.auth.mode(mode), payload);
      if (mode === "forgot") {
        setResetUrl(data.resetUrl || "sent");
        setPending(false);
        return;
      }
      const dest = data.onboarded ? next || "/" : "/onboarding";
      router.replace(dest);
      router.refresh();
    } catch (e) {
      setError(errorFromCatch(e));
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
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
            <Blocks size={18} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Pagistry
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            {c.title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{c.sub}</p>
        </div>

        {(mode === "login" || mode === "signup") && (
          <div className="mb-5">
            <OAuthButtons next={next} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "forgot" && resetUrl ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <ResetSentContent resetUrl={resetUrl} copied={copied} setCopied={setCopied} />
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <AuthFormFields
                mode={mode}
                name={name}
                email={email}
                password={password}
                onName={setName}
                onEmail={setEmail}
                onPassword={setPassword}
                error={error}
                pending={pending}
                cta={c.cta}
              />
            </motion.form>
          )}
        </AnimatePresence>

        <AuthFooter mode={mode} />
      </motion.div>
    </div>
  );
}
