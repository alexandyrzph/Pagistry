# Auth Redesign + OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the doodle split-screen auth with a centered frosted card over a full-bleed wallpaper, and add working env-gated Google + GitHub OAuth.

**Architecture:** New `OAuthAccount` model + nullable password; a pure OAuth provider module (`lib/auth/oauth.ts`) + pure HMAC state helper (`lib/auth/oauth-state.ts`); start/callback routes under `app/api/auth/oauth/[provider]`; a `linkOrCreateUser` server helper that mirrors email-signup (auto-creates a workspace). `AuthScreen` is rebuilt and renders an `OAuthButtonRow` gated by `GET /api/auth/providers`.

**Tech Stack:** Next 16 route handlers, Prisma + SQLite (`db push`), node:crypto HMAC, Vitest (node + jsdom), Tailwind v4, lucide-react.

---

## Project ② is out of scope

This is **Project ①**. Public workspaces, request-access, the create-workspace onboarding flow + image upload, and changing the auto-create-workspace behavior are **Project ②** (a later cycle). Here, new OAuth/email users still auto-create a workspace.

## File structure

| File                                                                                   | Responsibility                                                     | Action |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| `prisma/schema.prisma`                                                                 | nullable `passwordHash` + `OAuthAccount` model                     | Modify |
| `lib/auth/auth.ts`                                                                     | `verifyPassword` accepts `string \| null`                          | Modify |
| `lib/auth/oauth-state.ts`                                                              | pure HMAC state sign/verify (CSRF)                                 | Create |
| `lib/auth/oauth.ts`                                                                    | provider config, gating, authorize URL, token/profile, normalizers | Create |
| `lib/auth/oauth-account.ts`                                                            | `linkOrCreateUser` (DB create-or-link)                             | Create |
| `app/api/auth/providers/route.ts`                                                      | GET configured providers                                           | Create |
| `app/api/auth/oauth/[provider]/route.ts`                                               | GET start (state cookie + redirect)                                | Create |
| `app/api/auth/oauth/[provider]/callback/route.ts`                                      | GET callback                                                       | Create |
| `components/auth/OAuthButtons.tsx`                                                     | `OAuthButtonRow` (pure) + `OAuthButtons` (fetches)                 | Create |
| `components/auth/AuthScreen.tsx`                                                       | centered-card + wallpaper rebuild + OAuth row + error              | Modify |
| `app/(auth)/login/page.tsx`                                                            | pass `?error` to AuthScreen                                        | Modify |
| `public/auth/login-bg.jpg`                                                             | downloaded wallpaper (controller-selected)                         | Create |
| `.env`                                                                                 | `AUTH_SECRET` + provider cred placeholders (gitignored)            | Modify |
| `tests/oauth-state.test.ts`, `tests/oauth.test.ts`, `tests/oauth-buttons.dom.test.tsx` | unit/dom                                                           | Create |

**Gate:** `npx tsc --noEmit` + `npm test`. Never run `next build`. The wallpaper download (Task 8) and `.env` edits (Task 9) are handled by the controller, not subagents.

---

### Task 1: Schema — nullable password + OAuthAccount

**Files:** Modify `prisma/schema.prisma`, `lib/auth/auth.ts`

- [ ] **Step 1: Edit the `User` model** — make `passwordHash` optional and add the relation:

```prisma
  passwordHash String?
```

and add inside `model User { ... }` alongside the other relations:

```prisma
  oauthAccounts OAuthAccount[]
```

- [ ] **Step 2: Add the `OAuthAccount` model** (after `model User`):

```prisma
model OAuthAccount {
  id                String   @id @default(cuid())
  provider          String   // "google" | "github"
  providerAccountId String
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt         DateTime @default(now())

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

- [ ] **Step 3: Relax `verifyPassword`** in `lib/auth/auth.ts` (body unchanged — it already handles falsy):

```ts
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [salt, key] = (stored || "").split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return keyBuf.length === buf.length && timingSafeEqual(keyBuf, buf);
}
```

- [ ] **Step 4: Apply + verify**

Run: `npx prisma db push && npx tsc --noEmit`
Expected: "in sync" + "Generated Prisma Client"; tsc clean. (`app/api/auth/login/route.ts` passes `user.passwordHash` which is now `string | null` — still type-checks.)

- [ ] **Step 5: Commit** (do NOT stage `prisma/dev.db`)

```bash
git add prisma/schema.prisma lib/auth/auth.ts
git commit -m "feat(auth): nullable password + OAuthAccount model"
```

---

### Task 2: OAuth state helper (CSRF) — TDD

**Files:** Create `lib/auth/oauth-state.ts`, `tests/oauth-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/oauth-state.test.ts
import { describe, it, expect } from "vitest";
import { signState, verifyState } from "@/lib/auth/oauth-state";

describe("oauth state", () => {
  const NOW = 1_000_000_000_000;

  it("round-trips the payload", () => {
    const t = signState({ next: "/dashboard" }, NOW);
    expect(verifyState(t, NOW)).toEqual({ next: "/dashboard" });
  });

  it("works with no next", () => {
    const t = signState({}, NOW);
    expect(verifyState(t, NOW)).toEqual({ next: "" });
  });

  it("rejects a tampered token", () => {
    const t = signState({ next: "/x" }, NOW);
    expect(verifyState(t + "z", NOW)).toBeNull();
    expect(verifyState("garbage", NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const t = signState({ next: "/x" }, NOW);
    expect(verifyState(t, NOW + 11 * 60_000)).toBeNull(); // > 10 min TTL
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/oauth-state.test.ts`
Expected: cannot resolve `@/lib/auth/oauth-state`.

- [ ] **Step 3: Implement**

```ts
// lib/auth/oauth-state.ts
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-auth-secret-change-me";
const TTL_MS = 10 * 60_000; // 10 minutes

type StatePayload = { next: string };

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

/** Token = "<base64url(json)>.<hmac>"; json = { next, nonce, exp }. */
export function signState(data: { next?: string }, now: number = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({
      next: data.next || "",
      nonce: randomBytes(8).toString("hex"),
      exp: now + TTL_MS,
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyState(token: string, now: number = Date.now()): StatePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof json.exp !== "number" || json.exp < now) return null;
    return { next: typeof json.next === "string" ? json.next : "" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/oauth-state.test.ts`, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/oauth-state.ts tests/oauth-state.test.ts
git commit -m "feat(auth): HMAC OAuth state helper (CSRF)"
```

---

### Task 3: OAuth provider module — TDD (pure parts)

**Files:** Create `lib/auth/oauth.ts`, `tests/oauth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/oauth.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  oauthProviders,
  buildAuthorizeUrl,
  normalizeGoogleProfile,
  normalizeGithubProfile,
} from "@/lib/auth/oauth";

afterEach(() => vi.unstubAllEnvs());

describe("oauthProviders", () => {
  it("lists only fully-configured providers", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect(oauthProviders()).toEqual(["google"]);
  });
  it("is empty when nothing configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect(oauthProviders()).toEqual([]);
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds a Google consent URL with the right params", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const u = new URL(buildAuthorizeUrl("google", "STATE123"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("gid");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/oauth/google/callback",
    );
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe("STATE123");
  });
});

describe("profile normalizers", () => {
  it("normalizes a Google userinfo payload", () => {
    expect(
      normalizeGoogleProfile({ sub: "123", email: "a@b.com", email_verified: true, name: "Ann" }),
    ).toEqual({ providerAccountId: "123", email: "a@b.com", emailVerified: true, name: "Ann" });
  });
  it("normalizes GitHub user + picks the primary verified email", () => {
    const user = { id: 42, login: "octo", name: "Octo Cat", email: null };
    const emails = [
      { email: "old@x.com", primary: false, verified: true },
      { email: "octo@x.com", primary: true, verified: true },
    ];
    expect(normalizeGithubProfile(user, emails)).toEqual({
      providerAccountId: "42",
      email: "octo@x.com",
      emailVerified: true,
      name: "Octo Cat",
    });
  });
  it("falls back to login when GitHub name is missing and marks unverified email", () => {
    const user = { id: 7, login: "ghost", name: null, email: null };
    const emails = [{ email: "g@x.com", primary: true, verified: false }];
    expect(normalizeGithubProfile(user, emails)).toEqual({
      providerAccountId: "7",
      email: "g@x.com",
      emailVerified: false,
      name: "ghost",
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/oauth.test.ts`).

- [ ] **Step 3: Implement**

```ts
// lib/auth/oauth.ts
export type Provider = "google" | "github";

export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
};

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  idEnv: string;
  secretEnv: string;
};

const CONFIG: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    idEnv: "GITHUB_CLIENT_ID",
    secretEnv: "GITHUB_CLIENT_SECRET",
  },
};

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function redirectUri(provider: Provider): string {
  return `${appUrl()}/api/auth/oauth/${provider}/callback`;
}

export function isProvider(p: string): p is Provider {
  return p === "google" || p === "github";
}

export function oauthProviders(): Provider[] {
  return (Object.keys(CONFIG) as Provider[]).filter(
    (p) => !!process.env[CONFIG[p].idEnv] && !!process.env[CONFIG[p].secretEnv],
  );
}

export function buildAuthorizeUrl(provider: Provider, state: string): string {
  const cfg = CONFIG[provider];
  const params = new URLSearchParams({
    client_id: process.env[cfg.idEnv] || "",
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (provider === "google") params.set("prompt", "select_account");
  if (provider === "github") params.set("allow_signup", "true");
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export function normalizeGoogleProfile(raw: any): OAuthProfile {
  return {
    providerAccountId: String(raw.sub),
    email: raw.email ?? null,
    emailVerified: raw.email_verified === true || raw.email_verified === "true",
    name: raw.name || raw.email || "",
  };
}

export function normalizeGithubProfile(
  user: any,
  emails: Array<{ email: string; primary: boolean; verified: boolean }>,
): OAuthProfile {
  const primary = emails.find((e) => e.primary) || emails[0];
  return {
    providerAccountId: String(user.id),
    email: primary?.email ?? user.email ?? null,
    emailVerified: !!primary?.verified,
    name: user.name || user.login || "",
  };
}

// --- network helpers (not unit-tested; exercised in the manual checklist) ---

export async function exchangeCode(provider: Provider, code: string): Promise<string> {
  const cfg = CONFIG[provider];
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env[cfg.idEnv] || "",
      client_secret: process.env[cfg.secretEnv] || "",
      code,
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`token exchange failed: ${res.status}`);
  return data.access_token as string;
}

export async function fetchProfile(provider: Provider, accessToken: string): Promise<OAuthProfile> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "user-agent": "pagistry",
  };
  if (provider === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers });
    if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
    return normalizeGoogleProfile(await res.json());
  }
  const [uRes, eRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  if (!uRes.ok) throw new Error(`github user failed: ${uRes.status}`);
  const user = await uRes.json();
  const emails = eRes.ok ? await eRes.json() : [];
  return normalizeGithubProfile(user, Array.isArray(emails) ? emails : []);
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/oauth.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/oauth.ts tests/oauth.test.ts
git commit -m "feat(auth): OAuth provider module (gating, authorize URL, profile normalizers)"
```

---

### Task 4: create-or-link helper

**Files:** Create `lib/auth/oauth-account.ts`

> DB-touching; verified in the manual checklist (consistent with the codebase, which doesn't unit-test DB handlers).

- [ ] **Step 1: Implement**

```ts
// lib/auth/oauth-account.ts
import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/lib/auth/workspace";
import type { OAuthProfile, Provider } from "@/lib/auth/oauth";

/**
 * Resolve an OAuth identity to a user id:
 *  1. existing linked account → that user
 *  2. verified email matching an existing user → link + return
 *  3. otherwise create a new user (null password) + auto-create their workspace
 * Throws "email_in_use" if the (unverified) email already belongs to an account.
 */
export async function linkOrCreateUser(provider: Provider, profile: OAuthProfile): Promise<string> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId },
    },
  });
  if (linked) return linked.userId;

  const email = profile.email ? profile.email.toLowerCase() : null;

  if (email && profile.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await prisma.oAuthAccount.create({
        data: { provider, providerAccountId: profile.providerAccountId, userId: byEmail.id },
      });
      return byEmail.id;
    }
  }

  if (email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new Error("email_in_use"); // unverified provider email — don't take over
  }

  const finalEmail =
    email || `${provider}-${profile.providerAccountId}@users.noreply.pagistry.local`;
  const user = await prisma.user.create({
    data: { email: finalEmail, name: profile.name || "", passwordHash: null },
  });
  await prisma.oAuthAccount.create({
    data: { provider, providerAccountId: profile.providerAccountId, userId: user.id },
  });
  await createWorkspace(user.id, `${(profile.name || "My").trim() || "My"}'s Workspace`);
  return user.id;
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (clean; `prisma.oAuthAccount` resolves after Task 1's `db push`).

- [ ] **Step 3: Commit**

```bash
git add lib/auth/oauth-account.ts
git commit -m "feat(auth): linkOrCreateUser (create-or-link OAuth identity)"
```

---

### Task 5: OAuth routes (providers, start, callback)

**Files:** Create `app/api/auth/providers/route.ts`, `app/api/auth/oauth/[provider]/route.ts`, `app/api/auth/oauth/[provider]/callback/route.ts`

- [ ] **Step 1: providers endpoint**

```ts
// app/api/auth/providers/route.ts
import { json } from "@/lib/api/api-response";
import { oauthProviders } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/providers — which OAuth providers are configured (public; for the login UI)
export async function GET() {
  return json({ providers: oauthProviders() });
}
```

- [ ] **Step 2: start route**

```ts
// app/api/auth/oauth/[provider]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isProvider, oauthProviders, buildAuthorizeUrl } from "@/lib/auth/oauth";
import { signState } from "@/lib/auth/oauth-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const next = new URL(req.url).searchParams.get("next") || "";
  if (!isProvider(provider) || !oauthProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/login?error=provider_unavailable", req.url));
  }
  const state = signState({ next });
  const jar = await cookies();
  jar.set("pc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthorizeUrl(provider, state));
}
```

- [ ] **Step 3: callback route**

```ts
// app/api/auth/oauth/[provider]/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isProvider, oauthProviders, exchangeCode, fetchProfile } from "@/lib/auth/oauth";
import { verifyState } from "@/lib/auth/oauth-state";
import { linkOrCreateUser } from "@/lib/auth/oauth-account";
import { createSession } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (url.searchParams.get("error")) return to("/login?error=oauth_denied");
  if (!isProvider(provider) || !oauthProviders().includes(provider))
    return to("/login?error=provider_unavailable");

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const jar = await cookies();
  const cookieState = jar.get("pc_oauth_state")?.value;
  jar.delete("pc_oauth_state");

  if (!code || !stateParam || !cookieState || stateParam !== cookieState)
    return to("/login?error=oauth_state");
  const decoded = verifyState(stateParam);
  if (!decoded) return to("/login?error=oauth_state");

  try {
    const token = await exchangeCode(provider, code);
    const profile = await fetchProfile(provider, token);
    const userId = await linkOrCreateUser(provider, profile);
    await createSession(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const safeNext =
      decoded.next && decoded.next.startsWith("/") && !decoded.next.startsWith("//")
        ? decoded.next
        : "/";
    return to(user?.onboardedAt ? safeNext : "/onboarding");
  } catch (e) {
    const reason =
      e instanceof Error && e.message === "email_in_use" ? "email_in_use" : "oauth_failed";
    console.error("[oauth] callback failed", provider, e);
    return to(`/login?error=${reason}`);
  }
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/providers/route.ts "app/api/auth/oauth/[provider]/route.ts" "app/api/auth/oauth/[provider]/callback/route.ts"
git commit -m "feat(auth): OAuth start + callback + providers routes"
```

---

### Task 6: OAuth buttons component — TDD

**Files:** Create `components/auth/OAuthButtons.tsx`, `tests/oauth-buttons.dom.test.tsx`

- [ ] **Step 1: Write the failing dom test**

```tsx
// tests/oauth-buttons.dom.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OAuthButtonRow } from "@/components/auth/OAuthButtons";

describe("OAuthButtonRow", () => {
  it("renders a link per configured provider with the right href", () => {
    const { container } = render(<OAuthButtonRow providers={["google", "github"]} next="/dash" />);
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue with GitHub/i)).toBeInTheDocument();
    expect(container.querySelector('a[href="/api/auth/oauth/google?next=%2Fdash"]')).not.toBeNull();
    expect(container.querySelector('a[href="/api/auth/oauth/github?next=%2Fdash"]')).not.toBeNull();
  });

  it("renders only the configured provider", () => {
    render(<OAuthButtonRow providers={["github"]} />);
    expect(screen.queryByText(/Continue with Google/i)).toBeNull();
    expect(screen.getByText(/Continue with GitHub/i)).toBeInTheDocument();
  });

  it("renders nothing when no providers", () => {
    const { container } = render(<OAuthButtonRow providers={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/oauth-buttons.dom.test.tsx`).

- [ ] **Step 3: Implement**

```tsx
// components/auth/OAuthButtons.tsx
"use client";

import { useEffect, useState } from "react";
import type { Provider } from "@/lib/auth/oauth";

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
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

const LABEL: Record<Provider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
};
const GLYPH: Record<Provider, () => React.ReactNode> = { google: GoogleGlyph, github: GithubGlyph };

/** Presentational: render a button per provider (pure, unit-tested). */
export function OAuthButtonRow({ providers, next }: { providers: Provider[]; next?: string }) {
  if (providers.length === 0) return null;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="space-y-2.5">
      {providers.map((p) => {
        const Glyph = GLYPH[p];
        return (
          <a
            key={p}
            href={`/api/auth/oauth/${p}${q}`}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50"
          >
            <Glyph /> {LABEL[p]}
          </a>
        );
      })}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400">or continue with email</span>
        <span className="h-px flex-1 bg-zinc-200" />
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
      .then((d) => setProviders(Array.isArray(d.providers) ? d.providers : []))
      .catch(() => {});
  }, []);
  return <OAuthButtonRow providers={providers} next={next} />;
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/oauth-buttons.dom.test.tsx`, 3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/auth/OAuthButtons.tsx tests/oauth-buttons.dom.test.tsx
git commit -m "feat(auth): OAuth buttons (gated row + provider glyphs)"
```

---

### Task 7: Rebuild AuthScreen (centered card + wallpaper + OAuth + error)

**Files:** Modify `components/auth/AuthScreen.tsx`, `app/(auth)/login/page.tsx`

- [ ] **Step 1: Pass the `?error` code into AuthScreen** in `app/(auth)/login/page.tsx`:

```tsx
import { AuthScreen } from "@/components/auth/AuthScreen";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <AuthScreen mode="login" next={next} errorCode={error} />;
}
```

- [ ] **Step 2: Replace `components/auth/AuthScreen.tsx`** entirely with the version below (keeps all form logic + the forgot/reset "sent" UI; swaps the split-screen for a centered card over a wallpaper; adds OAuth + initial error). Note the helper components `InputBox`/`FieldInput` are kept at the bottom unchanged — include them in the replacement.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Copy, Layout, Loader2, Lock, Mail, User } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

type Mode = "login" | "signup" | "forgot" | "reset";

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

const ERROR_COPY: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.",
  oauth_failed: "Could not sign in with that provider. Please try again.",
  oauth_state: "Your sign-in session expired. Please try again.",
  provider_unavailable: "That sign-in method isn't available.",
  email_in_use: "An account with that email already exists — sign in with your password.",
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
  const [error, setError] = useState<string | null>(
    errorCode ? ERROR_COPY[errorCode] || "Something went wrong. Please try again." : null,
  );
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
        mode === "signup"
          ? { name, email, password }
          : mode === "login"
            ? { email, password }
            : mode === "forgot"
              ? { email }
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
      {/* wallpaper + overlays */}
      <div className="absolute inset-0 -z-20 bg-zinc-900 bg-[url('/auth/login-bg.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-950/80 via-zinc-900/70 to-indigo-950/80" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl sm:p-9"
      >
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Layout size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">Pagistry</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{c.title}</h1>
          <p className="mt-1.5 text-sm text-zinc-500">{c.sub}</p>
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
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <Check size={18} className="mt-0.5 shrink-0" />
                <p>If an account exists for that email, a reset link has been created.</p>
              </div>
              {resetUrl !== "sent" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">
                    No email service is configured — use this link to reset:
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <code className="min-w-0 flex-1 truncate text-xs text-zinc-600">
                      {resetUrl}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(resetUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}{" "}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <Link
                    href={resetUrl.replace(/^https?:\/\/[^/]+/, "")}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Open reset page <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {mode === "signup" && (
                <FieldInput
                  icon={<User size={15} />}
                  label="Name"
                  type="text"
                  value={name}
                  onChange={setName}
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
                  onChange={setEmail}
                  placeholder="you@company.com"
                  required
                  autoFocus={mode !== "signup"}
                />
              )}
              {(mode === "login" || mode === "signup" || mode === "reset") && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-600">Password</label>
                    {mode === "login" && (
                      <Link
                        href="/forgot"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Forgot?
                      </Link>
                    )}
                  </div>
                  <InputBox icon={<Lock size={15} />}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                      autoFocus={mode === "reset"}
                      className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  </InputBox>
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    {c.cta} <ArrowRight size={15} />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {mode === "login" && (
            <>
              New to Pagistry?{" "}
              <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Create an account
              </Link>
            </>
          )}
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Sign in
              </Link>
            </>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Back to sign in
            </Link>
          )}
        </p>
      </motion.div>
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
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      <InputBox icon={icon}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </InputBox>
    </div>
  );
}
```

(The `DoodleBuild/DoodleMagic/DoodleWave` and `cn` imports are intentionally dropped — `doodles.tsx` stays for the onboarding tour.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` (clean; all suites green). The wallpaper file doesn't exist yet — the page still renders (the `bg-zinc-900` base + gradient overlay show); Task 8 adds the image.

- [ ] **Step 4: Commit**

```bash
git add components/auth/AuthScreen.tsx "app/(auth)/login/page.tsx"
git commit -m "feat(auth): centered-card auth over wallpaper + OAuth + error messages"
```

---

### Task 8: Wallpaper asset (controller-handled)

**Files:** Create `public/auth/login-bg.jpg`

> The controller downloads and visually selects the image (subjective). Subagents skip this task.

- [ ] **Step 1:** Download a dark, premium, abstract/architectural **free-license (Unsplash)** image (~2400px wide) to `public/auth/login-bg.jpg`. Pinned default:
      `https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=2400&auto=format&fit=crop`
  ```bash
  mkdir -p public/auth
  curl -sL "<chosen-url>" -o public/auth/login-bg.jpg
  ```
- [ ] **Step 2:** Verify it's a real image (`ls -la public/auth/login-bg.jpg` > 50 KB) and view it; swap the URL if it doesn't look premium/legible-under-overlay.
- [ ] **Step 3: Commit**
  ```bash
  git add public/auth/login-bg.jpg
  git commit -m "feat(auth): login wallpaper"
  ```

---

### Task 9: Environment (controller-handled, gitignored)

**Files:** Modify `.env`

- [ ] **Step 1:** Append to `.env` (gitignored — no commit):
  ```
  # OAuth state signing
  AUTH_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
  # Google OAuth — create at https://console.cloud.google.com (redirect: ${APP_URL}/api/auth/oauth/google/callback)
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  # GitHub OAuth — create at https://github.com/settings/developers (callback: ${APP_URL}/api/auth/oauth/github/callback)
  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  ```
  Leaving the client id/secret blank keeps the buttons hidden (gating works); fill them to enable each provider. Restart `next dev` after editing `.env`.

---

### Task 10: Manual verification

- [ ] **Step 1:** `npm run dev`; open `/login` and `/signup` — confirm the centered card over the wallpaper, no doodle, no stray "N" avatar; forgot/reset still work.
- [ ] **Step 2:** With no creds set: confirm NO OAuth buttons and NO divider (gating). `curl -s localhost:3000/api/auth/providers` → `{"providers":[]}`.
- [ ] **Step 3:** Add real Google + GitHub creds to `.env`, restart; confirm both buttons appear. Click each → consent → returns signed-in to `/` or `/onboarding`. Confirm a `User` + `OAuthAccount` row exist and a workspace was created for a brand-new user.
- [ ] **Step 4:** Sign in with Google using an email that already has a password account (verified) → confirm it links (same user, new `OAuthAccount`) rather than duplicating.
- [ ] **Step 5:** Cancel consent → returns to `/login` with the friendly "Sign-in was cancelled." message.
- [ ] **Step 6:** Email/password login + signup still work unchanged.

---

## Self-Review

**Spec coverage:**

- Centered card + wallpaper + remove doodle/"N" → Task 7 (+ Task 8 asset). ✅
- OAuth full flow (start/callback/token/profile/link/session) → Tasks 3, 4, 5. ✅
- Env-gating + providers endpoint + gated buttons → Tasks 3 (`oauthProviders`), 5, 6. ✅
- Schema (nullable password + OAuthAccount) → Task 1. ✅
- Verified-email auto-linking + new-user+workspace seam → Task 4. ✅
- CSRF state → Task 2, used in Task 5. ✅
- Error messages on `/login?error=` → Task 5 (redirects) + Task 7 (`ERROR_COPY`). ✅
- Open-redirect guard on `next` → Task 5 (`safeNext`). ✅
- Tests: state, provider gating/authorize-url/normalizers, button row → Tasks 2, 3, 6. ✅
- Post-auth `/onboarding` for un-onboarded → Task 5 (mirrors email flow). ✅
- Out of scope (Project ②) honored — workspace auto-create kept. ✅

**Placeholder scan:** none — the wallpaper URL is a concrete pinned default with a swap instruction; `.env` values are explicit generate/blank instructions.

**Type consistency:** `Provider` ("google"|"github") and `OAuthProfile` defined in Task 3, consumed by Tasks 4 (`linkOrCreateUser`), 5 (routes), 6 (`OAuthButtonRow` props). `oauthProviders(): Provider[]`, `buildAuthorizeUrl(provider, state)`, `exchangeCode(provider, code)`, `fetchProfile(provider, token)` signatures consistent across Tasks 3 & 5. `signState({next})`/`verifyState(token) → {next}|null` consistent across Tasks 2 & 5. `prisma.oAuthAccount` + `provider_providerAccountId` match the Task 1 model. `verifyPassword(_, string|null)` (Task 1) matches the existing login route call. `AuthScreen` gains `errorCode?` (Task 7) supplied by the login page (Task 7 Step 1). ✅
