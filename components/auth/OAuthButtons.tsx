"use client";

import { useEffect, useState } from "react";
import type { Provider } from "@/lib/auth/oauth";

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const LABEL: Record<Provider, string> = { google: "Continue with Google", github: "Continue with GitHub" };
const GLYPH: Record<Provider, () => React.ReactNode> = { google: GoogleGlyph, github: GithubGlyph };

/** Presentational: render a button per provider (pure, unit-tested). */
export function OAuthButtonRow({ providers, next }: { providers: Provider[]; next?: string }) {
  if (providers.length === 0) return null;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="space-y-2.5">
      {providers.map((p) => {
        const Glyph = GLYPH[p];
        if (!Glyph) return null; // ignore any unknown provider rather than crash the card
        return (
          <a
            key={p}
            href={`/api/auth/oauth/${p}${q}`}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <Glyph /> {LABEL[p]}
          </a>
        );
      })}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400 dark:text-zinc-500">or continue with email</span>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

/** Fetches configured providers and renders the row (used by AuthScreen). */
export function OAuthButtons({ next }: { next?: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((d) =>
        setProviders(
          Array.isArray(d.providers)
            ? d.providers.filter((p: unknown): p is Provider => p === "google" || p === "github")
            : [],
        ),
      )
      .catch(() => {});
  }, []);
  return <OAuthButtonRow providers={providers} next={next} />;
}
