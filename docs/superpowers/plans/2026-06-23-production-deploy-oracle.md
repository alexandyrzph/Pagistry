# Production Deploy (Oracle Free VM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the page builder live in production on a free Oracle Always-Free VM via Docker Compose (Caddy + Next.js app + Postgres), closing the password-reset security hole and adding basic rate limiting along the way.

**Architecture:** One VM runs three containers behind Caddy (auto Let's Encrypt TLS + on-demand TLS for customer custom domains). The Next.js app talks to a Postgres container over the compose network; uploads live on a persistent Docker volume. No managed cloud services — effectively $0/month plus a cheap domain.

**Tech Stack:** Next.js 16.2.9, React 19, Prisma 6.19 (Postgres), Resend (email), Caddy 2, Postgres 16, Docker Compose, Node 22 (Debian bookworm base, ARM64).

## Global Constraints

- **This is a modified Next.js** — before writing Next-specific code, check `node_modules/next/dist/docs/` and heed deprecations (per AGENTS.md).
- **Fallow gate before every commit:** run `fallow audit --format json --quiet --explain --gate-marker agent`. If verdict is `fail`, fix the introduced findings before committing. Treat `{ "error": true, ... }` JSON runtime errors as non-blocking.
- **Full local gate** = `npx tsc --noEmit` + `npm test` + `npm run lint` + `npm run format:check`. Do NOT run `next build` while `next dev` is live (shared `.next/` causes render loops) — the gate is tsc + vitest, not a dev build.
- **Tests:** node/pure-logic tests live in `tests/**/*.test.ts` (vitest "node" project). Mirror the existing mocking style: `vi.mock(...)` for module boundaries, dynamic `await import("@/...")` to load the unit under test.
- **No justification comments** — keep diffs comment-free except where they explain genuinely non-obvious behavior in the existing house style.
- **HTTP via the axios client** (`lib/api/client.ts` + `lib/api/endpoints.ts`) on the browser side; server route handlers use the existing `lib/api/api-handler` + `lib/api/api-response` helpers.
- **Work on a branch**, not `main`. Branch name: `feat/production-deploy`.

---

## Phase A — Application readiness (code, behind the gate)

### Task A1: Switch Prisma from SQLite to Postgres + first migration

**Files:**
- Modify: `prisma/schema.prisma:5-8` (datasource block)
- Modify: `.gitignore` (stop tracking the SQLite file)
- Modify: `.env` (local `DATABASE_URL` → Postgres)
- Create: `prisma/migrations/**` (generated)
- Delete: `prisma/dev.db` (existing data is dropped per spec)

**Interfaces:**
- Produces: a committed `prisma/migrations/` history (replaces the `db push` workflow) and a Postgres-targeted client. No app code imports change — `lib/prisma.ts` is provider-agnostic.

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b feat/production-deploy
```

- [ ] **Step 2: Start a local Postgres for development**

```bash
docker run -d --name pagistry-pg -e POSTGRES_USER=pagistry -e POSTGRES_PASSWORD=devpw -e POSTGRES_DB=pagistry -p 5432:5432 postgres:16
```

Expected: prints a container id; `docker ps` shows `pagistry-pg` up.

- [ ] **Step 3: Point local env at Postgres**

In `.env`, replace the `DATABASE_URL=...` line with:

```
DATABASE_URL="postgresql://pagistry:devpw@localhost:5432/pagistry"
```

- [ ] **Step 4: Flip the Prisma provider**

In `prisma/schema.prisma`, change the datasource block to:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 5: Stop tracking the SQLite DB**

Add to `.gitignore` (under the `# typescript` / misc area):

```
/prisma/dev.db
/prisma/*.db-journal
```

Then untrack it:

```bash
git rm --cached prisma/dev.db
rm -f prisma/dev.db
```

- [ ] **Step 6: Generate the first real migration**

```bash
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<timestamp>_init/migration.sql`, applies it to the local Postgres, regenerates the client. No "provider mismatch" errors (JSON columns are `String`/`text`; the two enums — `DomainStatus`, `Role` — become native Postgres enums).

- [ ] **Step 7: Run the gate**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; all suites pass. (Route tests mock `lib/api/api-handler`, so they don't hit Postgres. If any suite needs a live DB, it now uses the local Postgres from Step 2.)

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations .gitignore
git commit -m "feat(db): switch Prisma to PostgreSQL with an initial migration"
```

---

### Task A2: In-memory rate limiter

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `hit(key: string, limit: number, windowMs: number, now: number): boolean` — pure fixed-window counter; `true` = allowed.
  - `clientIp(req: Request): string` — first IP from `X-Forwarded-For` (Caddy sets it), else `x-real-ip`, else `"unknown"`.
  - `enforce(req: Request, name: string, limit: number, windowMs: number): Response | null` — returns a 429 `Response` when the per-IP limit for `name` is exceeded, else `null`.
  - `resetRateLimits(): void` — clears all buckets (test/maintenance helper).

- [ ] **Step 1: Write the failing test**

```ts
// tests/rate-limit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { hit, clientIp, enforce, resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => resetRateLimits());

describe("hit", () => {
  it("allows up to the limit, then blocks within the window", () => {
    expect(hit("k", 2, 1000, 0)).toBe(true);
    expect(hit("k", 2, 1000, 100)).toBe(true);
    expect(hit("k", 2, 1000, 200)).toBe(false);
  });

  it("resets after the window elapses", () => {
    expect(hit("k", 1, 1000, 0)).toBe(true);
    expect(hit("k", 1, 1000, 500)).toBe(false);
    expect(hit("k", 1, 1000, 1000)).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    expect(hit("a", 1, 1000, 0)).toBe(true);
    expect(hit("b", 1, 1000, 0)).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first hop from X-Forwarded-For", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } });
    expect(clientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to unknown with no proxy headers", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("enforce", () => {
  it("returns null while under the limit and a 429 once over", async () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9" } });
    expect(enforce(req, "t", 1, 1000)).toBeNull();
    const blocked = enforce(req, "t", 1, 1000);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect((await blocked!.json()).error).toMatch(/too many/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: FAIL — cannot resolve `@/lib/rate-limit`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/rate-limit.ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function hit(key: string, limit: number, windowMs: number, now: number): boolean {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function enforce(
  req: Request,
  name: string,
  limit: number,
  windowMs: number,
): Response | null {
  if (hit(`${name}:${clientIp(req)}`, limit, windowMs, Date.now())) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(Math.ceil(windowMs / 1000)),
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts tests/rate-limit.test.ts
git commit -m "feat(security): add in-memory per-IP rate limiter"
```

---

### Task A3: Email module (Resend) with pure message builders

**Files:**
- Create: `lib/email/messages.ts`
- Create: `lib/email/index.ts`
- Test: `tests/email-messages.test.ts`
- Modify: `package.json` (add `resend` dependency)

**Interfaces:**
- Produces:
  - `passwordResetEmail(resetUrl: string): { subject: string; html: string }` (pure)
  - `workspaceInviteEmail(inviteUrl: string, workspaceName: string): { subject: string; html: string }` (pure)
  - `sendPasswordReset(to: string, resetUrl: string): Promise<void>`
  - `sendWorkspaceInvite(to: string, inviteUrl: string, workspaceName: string): Promise<void>`
  - When `RESEND_API_KEY` is unset, `send*` log a warning and no-op (keeps local dev working without keys).

- [ ] **Step 1: Install Resend**

```bash
npm install resend
```

Expected: `resend` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing test (pure builders)**

```ts
// tests/email-messages.test.ts
import { describe, it, expect } from "vitest";
import { passwordResetEmail, workspaceInviteEmail } from "@/lib/email/messages";

describe("passwordResetEmail", () => {
  it("has a subject and embeds the reset link", () => {
    const { subject, html } = passwordResetEmail("https://app.example.com/reset?token=abc");
    expect(subject).toMatch(/reset/i);
    expect(html).toContain('href="https://app.example.com/reset?token=abc"');
  });
});

describe("workspaceInviteEmail", () => {
  it("names the workspace and embeds the invite link", () => {
    const { subject, html } = workspaceInviteEmail("https://app.example.com/invite/xyz", "Acme");
    expect(subject).toMatch(/invite/i);
    expect(html).toContain("Acme");
    expect(html).toContain('href="https://app.example.com/invite/xyz"');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/email-messages.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/messages`.

- [ ] **Step 4: Implement the pure builders**

```ts
// lib/email/messages.ts
function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h1 style="font-size:18px;margin:0 0 16px">${title}</h1>
  ${bodyHtml}
  <p style="color:#888;font-size:12px;margin-top:24px">If you didn't expect this email, you can safely ignore it.</p>
</div>`;
}

function button(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">${label}</a></p>`;
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      `<p>Use the button below to choose a new password. This link expires in one hour.</p>${button(resetUrl, "Reset password")}`,
    ),
  };
}

export function workspaceInviteEmail(
  inviteUrl: string,
  workspaceName: string,
): { subject: string; html: string } {
  return {
    subject: `You've been invited to ${workspaceName}`,
    html: layout(
      `Join ${workspaceName}`,
      `<p>You've been invited to collaborate on <strong>${workspaceName}</strong>. This invite expires in 7 days.</p>${button(inviteUrl, "Accept invite")}`,
    ),
  };
}
```

- [ ] **Step 5: Implement the sender**

```ts
// lib/email/index.ts
import { Resend } from "resend";
import { passwordResetEmail, workspaceInviteEmail } from "@/lib/email/messages";
import { logger } from "@/lib/observability";

const FROM = process.env.EMAIL_FROM || "Pagistry <onboarding@resend.dev>";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const c = client();
  if (!c) {
    logger.warn("email.skipped_no_key", { to, subject });
    return;
  }
  try {
    await c.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error("email.send_failed", {
      to,
      subject,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const { subject, html } = passwordResetEmail(resetUrl);
  await send(to, subject, html);
}

export async function sendWorkspaceInvite(
  to: string,
  inviteUrl: string,
  workspaceName: string,
): Promise<void> {
  const { subject, html } = workspaceInviteEmail(inviteUrl, workspaceName);
  await send(to, subject, html);
}
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run tests/email-messages.test.ts && npx tsc --noEmit`
Expected: tests PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add lib/email package.json package-lock.json tests/email-messages.test.ts
git commit -m "feat(email): add Resend-backed transactional email module"
```

---

### Task A4: Wire email + rate limiting into routes; close the password-reset leak

**Files:**
- Modify: `app/api/auth/forgot/route.ts` (send email, stop returning the reset link)
- Modify: `app/api/workspaces/invites/route.ts` (send invite email)
- Modify: `app/api/auth/login/route.ts` (rate limit)
- Modify: `app/api/auth/signup/route.ts` (rate limit)
- Modify: `app/api/ai/route.ts` (rate limit)
- Modify: `app/api/upload/route.ts` (rate limit)
- Test: `tests/forgot-route.test.ts`

**Interfaces:**
- Consumes: `enforce` (Task A2), `sendPasswordReset` / `sendWorkspaceInvite` (Task A3).
- Produces: `/api/auth/forgot` no longer returns `resetUrl` in its body and no longer logs it; it emails the link instead.

- [ ] **Step 1: Write the failing test for the forgot route**

```ts
// tests/forgot-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  sent: [] as Array<{ to: string; url: string }>,
  created: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => state.user) },
    passwordReset: { create: vi.fn(async (args: unknown) => state.created.push(args)) },
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordReset: vi.fn(async (to: string, url: string) => {
    state.sent.push({ to, url });
  }),
}));

async function callForgot(email: unknown) {
  const { POST } = await import("@/app/api/auth/forgot/route");
  return POST(
    new Request("http://x/api/auth/forgot", {
      method: "POST",
      headers: { "x-forwarded-for": "5.5.5.5" },
      body: JSON.stringify({ email }),
    }),
  );
}

beforeEach(async () => {
  state.user = null;
  state.sent = [];
  state.created = [];
  const { resetRateLimits } = await import("@/lib/rate-limit");
  resetRateLimits();
});

describe("POST /api/auth/forgot", () => {
  it("never leaks the reset link in the response body", async () => {
    state.user = { id: "u1", email: "a@b.com" };
    const res = await callForgot("a@b.com");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(body).not.toHaveProperty("resetUrl");
  });

  it("emails the reset link when the user exists", async () => {
    state.user = { id: "u1", email: "a@b.com" };
    await callForgot("a@b.com");
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].to).toBe("a@b.com");
    expect(state.sent[0].url).toMatch(/\/reset\?token=/);
  });

  it("does not reveal whether an unknown email exists and sends nothing", async () => {
    state.user = null;
    const res = await callForgot("nobody@b.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.sent).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/forgot-route.test.ts`
Expected: FAIL — current route returns `{ ok: true, resetUrl }` and does not call `sendPasswordReset`.

- [ ] **Step 3: Rewrite the forgot route**

```ts
// app/api/auth/forgot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newToken } from "@/lib/auth/auth";
import { sendPasswordReset } from "@/lib/email";
import { enforce } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforce(req, "forgot", 5, 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  // Don't reveal whether the email exists.
  if (!user) return NextResponse.json({ ok: true });

  const token = newToken();
  await prisma.passwordReset.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const resetUrl = `${new URL(req.url).origin}/reset?token=${token}`;
  await sendPasswordReset(user.email, resetUrl);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/forgot-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Send the invite email**

In `app/api/workspaces/invites/route.ts`, add the import near the top:

```ts
import { sendWorkspaceInvite } from "@/lib/email";
```

Then in `POST`, after `await logActivity(...)` and before building the response, replace the tail of the handler with:

```ts
    const origin = new URL(req.url).origin;
    const inviteUrl = `${origin}/invite/${token}`;
    await sendWorkspaceInvite(email, inviteUrl, ws.workspace.name);
    return created({ inviteUrl });
```

(The response still returns `inviteUrl` — that's admin-only and safe; the new behavior is also emailing it. `ws.workspace.name` exists on the `Workspace` model.)

- [ ] **Step 6: Add rate limiting to the auth + cost-sensitive routes**

In `app/api/auth/login/route.ts`, add the import and guard:

```ts
import { enforce } from "@/lib/rate-limit";
```

As the first lines inside `POST(req)`:

```ts
  const limited = enforce(req, "login", 10, 60_000);
  if (limited) return limited;
```

In `app/api/auth/signup/route.ts`, add the same import and, as the first lines inside `POST(req)`:

```ts
  const limited = enforce(req, "signup", 5, 60_000);
  if (limited) return limited;
```

In `app/api/upload/route.ts`, add `import { enforce } from "@/lib/rate-limit";` and, as the first lines inside `POST(req)` (before `return withSiteRole(...)`):

```ts
  const limited = enforce(req, "upload", 30, 60_000);
  if (limited) return limited;
```

In `app/api/ai/route.ts`, add `import { enforce } from "@/lib/rate-limit";` and, as the first lines inside `POST(req)` (before `return instrumentApi(...)`):

```ts
  const limited = enforce(req, "ai", 20, 60_000);
  if (limited) return limited;
```

- [ ] **Step 7: Run the full gate**

Run: `npx tsc --noEmit && npm test && npm run lint && npm run format:check`
Expected: all green. (If `format:check` flags the edited files, run `npm run format` and re-check.)

- [ ] **Step 8: Commit**

```bash
git add app/api/auth/forgot/route.ts app/api/workspaces/invites/route.ts app/api/auth/login/route.ts app/api/auth/signup/route.ts app/api/upload/route.ts app/api/ai/route.ts tests/forgot-route.test.ts
git commit -m "feat(security): email reset/invite links + rate-limit auth, AI, and upload routes"
```

---

## Phase B — Containerization

### Task B1: Dockerfile + entrypoint (ARM64, Playwright/Chromium, migrate-on-boot)

**Files:**
- Create: `Dockerfile`
- Create: `docker/entrypoint.sh`
- Create: `.dockerignore`

**Interfaces:**
- Produces: a runnable image whose container runs `prisma migrate deploy` then `next start` on port 3000. Playwright Chromium is installed so thumbnail rendering works at runtime.

**Note on approach:** We copy the whole built app (not Next `standalone`) into the runner. Standalone does not reliably trace the runtime `import "playwright"` in `lib/thumbnails/screenshot.ts`; the full copy guarantees `playwright` resolves. Image size is irrelevant on the Oracle disk. Optimize to standalone later if desired.

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
coverage
docs
tests
*.tsbuildinfo
prisma/dev.db
.env
.env.*
.DS_Store
.idea
```

- [ ] **Step 2: Create the entrypoint**

```sh
# docker/entrypoint.sh
#!/bin/sh
set -e
echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy
echo "[entrypoint] starting Next.js..."
exec npm run start
```

- [ ] **Step 3: Create the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the fully built app (node_modules incl. playwright, .next, prisma, public).
COPY --from=build /app ./
# Install the Chromium browser + its system libraries for runtime thumbnails.
RUN npx playwright install --with-deps chromium
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 3000
CMD ["./docker/entrypoint.sh"]
```

- [ ] **Step 4: Build the image**

Run: `docker build -t pagistry-app .`
Expected: build completes; final stage logs Chromium install. (First build is slow — Chromium + deps.)

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker/entrypoint.sh .dockerignore
git commit -m "build: add Dockerfile (next start + prisma migrate deploy + playwright chromium)"
```

---

### Task B2: docker-compose stack (caddy + app + postgres)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.production.example`

**Interfaces:**
- Consumes: the image from B1 and the Caddyfile from B3.
- Produces: a three-service stack with healthchecks and named volumes (`pg_data`, `uploads`, `caddy_data`, `caddy_config`).

- [ ] **Step 1: Create the env template**

```
# .env.production.example — copy to .env on the server and fill in.
# Database (compose injects DATABASE_URL into the app from POSTGRES_PASSWORD).
POSTGRES_PASSWORD=change-me-strong

# Public domain (no scheme). www is added automatically by the Caddyfile.
APP_DOMAIN=example.com
APP_URL=https://example.com

# Auth / signing secrets — generate with: openssl rand -hex 32
AUTH_SECRET=
THUMBNAIL_SECRET=
METRICS_TOKEN=

# Email (Resend) — from address must be on your verified domain.
RESEND_API_KEY=
EMAIL_FROM="Pagistry <no-reply@example.com>"

# AI (optional)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# OAuth (optional; callbacks use APP_URL)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: pagistry
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: pagistry
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pagistry"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql://pagistry:${POSTGRES_PASSWORD}@postgres:5432/pagistry
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - uploads:/app/public/uploads
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://localhost:3000/api/internal/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
    volumes:
      - ./ops/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  pg_data:
  uploads:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: Verify compose config parses**

Run: `APP_DOMAIN=example.com POSTGRES_PASSWORD=x docker compose config >/dev/null && echo OK`
Expected: prints `OK` (no schema errors).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.production.example
git commit -m "build: add docker-compose stack (caddy + app + postgres) and env template"
```

---

### Task B3: Parameterize the Caddyfile + safe security headers

**Files:**
- Modify: `ops/Caddyfile`

**Interfaces:**
- Consumes: `APP_DOMAIN` env (set by compose); upstream service name `app:3000`.
- Produces: TLS for `${APP_DOMAIN}`/`www`, on-demand TLS for customer custom domains, and safe response headers.

**Note:** We deliberately set only the always-safe headers (HSTS, nosniff, referrer-policy) for launch. `X-Frame-Options`/full CSP are deferred — the editor uses a same-origin iframe canvas and published pages render user Embed/Code HTML, so a strict frame/CSP policy needs per-surface tuning (tracked in the spec's risks).

- [ ] **Step 1: Replace `ops/Caddyfile` contents**

```caddyfile
{
	on_demand_tls {
		ask http://app:3000/api/domains/check
	}
}

(security_headers) {
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}

{$APP_DOMAIN}, www.{$APP_DOMAIN} {
	import security_headers
	reverse_proxy app:3000
}

https:// {
	tls {
		on_demand
	}
	import security_headers
	reverse_proxy app:3000 {
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- [ ] **Step 2: Validate the Caddyfile syntax**

Run: `docker run --rm -e APP_DOMAIN=example.com -v "$PWD/ops/Caddyfile":/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile`
Expected: `Valid configuration`.

- [ ] **Step 3: Commit**

```bash
git add ops/Caddyfile
git commit -m "build(caddy): parameterize domain, internal upstream, and safe security headers"
```

---

### Task B4: Local end-to-end smoke (app + postgres containers)

**Files:** none (verification task).

**Interfaces:** Consumes B1+B2. Confirms the image boots, migrates, and serves a healthy response before touching the VM.

- [ ] **Step 1: Create a local `.env` for compose**

```bash
cp .env.production.example .env
```

Set in `.env`: `POSTGRES_PASSWORD=devpw`, `APP_DOMAIN=localhost`, `APP_URL=http://localhost:3000`, and `AUTH_SECRET`/`THUMBNAIL_SECRET`/`METRICS_TOKEN` to `openssl rand -hex 32` values. (`.env` is gitignored — never commit it.)

- [ ] **Step 2: Build and start app + postgres only (skip Caddy/TLS locally)**

```bash
docker compose up -d --build postgres app
```

Expected: both containers start; `docker compose ps` shows `app` becoming healthy within ~1 minute.

- [ ] **Step 3: Confirm migrations ran and health is green**

```bash
docker compose logs app | grep -i "applying database migrations"
docker compose exec app node -e "fetch('http://localhost:3000/api/internal/health').then(r=>r.json()).then(b=>{console.log(b);process.exit(b.status==='ok'?0:1)})"
```

Expected: log line present; health prints `status: "ok"` with `database.ok: true`.

- [ ] **Step 4: Tear down**

```bash
docker compose down
```

Expected: containers removed; named volumes persist. No commit (verification only).

---

## Phase C — Provisioning & go-live (manual runbook)

> These tasks run against real infrastructure (Oracle Cloud, DNS, Resend). They are checklists with exact commands and expected outcomes, not code/tests. Execute them on the VM unless noted.

### Task C1: Domain + Oracle Always-Free VM

- [ ] **Step 1: Buy a domain** at any cheap registrar (Cloudflare Registrar / Namecheap / Porkbun). Note the registrar's DNS panel.

- [ ] **Step 2: Create an Oracle Cloud account and upgrade to Pay-As-You-Go.** Still $0 under Always-Free limits; prevents Oracle from reclaiming the idle VM.

- [ ] **Step 3: Launch an Always-Free compute instance.**
  - Shape: `VM.Standard.A1.Flex` (ARM Ampere). Start with 2 OCPU / 12 GB (within Always-Free 4 OCPU / 24 GB).
  - Image: Ubuntu 22.04 (aarch64).
  - Add your SSH public key.
  - If the region reports "out of capacity," retry later or pick a different home region (A1 is the constrained shape).

- [ ] **Step 4: Open ports 80 and 443.**
  - In the VCN subnet's **security list**, add ingress rules: TCP 80 and TCP 443 from `0.0.0.0/0`.
  - On the VM, also allow them in the host firewall:

    ```bash
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
    sudo netfilter-persistent save
    ```

- [ ] **Step 5: Install Docker + compose plugin.**

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  newgrp docker
  docker compose version
  ```

  Expected: `docker compose version` prints a v2 version.

### Task C2: Deploy, DNS, TLS, smoke test

- [ ] **Step 1: Get the code onto the VM.**

  ```bash
  git clone <your-repo-url> pagistry && cd pagistry
  git checkout feat/production-deploy
  ```

- [ ] **Step 2: Create the production `.env`.**

  ```bash
  cp .env.production.example .env
  chmod 600 .env
  # Generate secrets:
  openssl rand -hex 32   # AUTH_SECRET
  openssl rand -hex 32   # THUMBNAIL_SECRET
  openssl rand -hex 32   # METRICS_TOKEN
  ```

  Fill in `.env`: `POSTGRES_PASSWORD`, `APP_DOMAIN` (your domain), `APP_URL=https://<domain>`, the three secrets, `RESEND_API_KEY`, `EMAIL_FROM` (on your domain), and any AI/OAuth keys.

- [ ] **Step 3: Point DNS at the VM.**
  - Add an `A` record: `@` → VM public IP.
  - Add an `A` record: `www` → VM public IP.
  - Verify: `dig +short <domain>` returns the VM IP (allow for propagation).

- [ ] **Step 4: Verify the Resend domain.** In the Resend dashboard, add your domain and create the DKIM/SPF DNS records it gives you at your registrar. Wait until Resend shows the domain as **Verified** (required before `EMAIL_FROM` on your domain will deliver).

- [ ] **Step 5: Launch the full stack.**

  ```bash
  docker compose up -d --build
  docker compose ps
  ```

  Expected: `postgres`, `app`, `caddy` all running; `app` healthy. Caddy obtains a Let's Encrypt cert for the domain on first HTTPS hit (`docker compose logs caddy` shows certificate issuance).

- [ ] **Step 6: Smoke test the live site.**

  ```bash
  curl -fsS https://<domain>/api/internal/health
  ```

  Expected: JSON `status:"ok"`, `database.ok:true`, HTTP 200. Then in a browser: sign up → log in → create a site → add a page → publish → open the published page. Trigger a password reset and confirm the email arrives (no link in the HTTP response).

- [ ] **Step 7: Run the scripted GUI smoke test against production.**

  From your local machine (Playwright installed):

  ```bash
  APP_URL=https://<domain> node scripts/verify.mjs
  ```

  Expected: the script's checks pass against the live URL.

- [ ] **Step 8: Merge the branch.** Once the live smoke passes, open a PR (run the fallow gate first) and merge `feat/production-deploy` to `main`.

---

## Phase D — Post-launch hardening

### Task D1: Nightly Postgres backup

**Files:**
- Create: `ops/backup.sh`

**Interfaces:** Produces a dated `pg_dump` in a host directory via cron; restorable with `psql`/`pg_restore`.

- [ ] **Step 1: Create the backup script**

```sh
# ops/backup.sh
#!/bin/sh
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=/home/ubuntu/pagistry-backups
mkdir -p "$DEST"
docker compose -f /home/ubuntu/pagistry/docker-compose.yml exec -T postgres \
  pg_dump -U pagistry pagistry | gzip > "$DEST/pagistry-$STAMP.sql.gz"
# Keep the 14 most recent.
ls -1t "$DEST"/pagistry-*.sql.gz | tail -n +15 | xargs -r rm --
```

- [ ] **Step 2: Make it executable and schedule it (on the VM)**

```bash
chmod +x ops/backup.sh
( crontab -l 2>/dev/null; echo "30 3 * * * /home/ubuntu/pagistry/ops/backup.sh >> /home/ubuntu/backup.log 2>&1" ) | crontab -
```

- [ ] **Step 3: Verify a backup runs and is non-empty**

```bash
/home/ubuntu/pagistry/ops/backup.sh && ls -lh /home/ubuntu/pagistry-backups
```

Expected: a `pagistry-<stamp>.sql.gz` file with non-zero size.

- [ ] **Step 4: Commit the script**

```bash
git add ops/backup.sh
git commit -m "ops: nightly pg_dump backup with 14-day retention"
```

### Task D2: Enforce the metrics token in production

**Files:**
- Modify: `app/api/internal/metrics/route.ts`

**Interfaces:** Produces a 401 on `/api/internal/metrics` unless the request presents `METRICS_TOKEN` (when the env var is set).

- [ ] **Step 1: Inspect the current route**

Run: `sed -n '1,60p' app/api/internal/metrics/route.ts`
Expected: see whether `METRICS_TOKEN` is already required. If it already enforces the token, mark this task done. Otherwise continue.

- [ ] **Step 2: Add the guard at the top of the GET handler**

```ts
  const required = process.env.METRICS_TOKEN;
  if (required) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== required) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
```

(If the existing `GET` has no `req` parameter, change its signature to `GET(req: Request)`.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean. On the VM after deploy: `curl -s -o /dev/null -w "%{http_code}" https://<domain>/api/internal/metrics` returns `401`, and with `-H "Authorization: Bearer $METRICS_TOKEN"` returns `200`.

- [ ] **Step 4: Commit**

```bash
git add app/api/internal/metrics/route.ts
git commit -m "feat(observability): require METRICS_TOKEN for the metrics endpoint"
```

---

## Out of scope (deferred to after launch)

- CI/CD (GitHub Actions) and Sentry error alerting.
- High availability / multi-instance / managed Postgres.
- Object storage / CDN for uploads (local volume is sufficient at launch).
- Full CSP / `X-Frame-Options` tuning for the editor vs. published-page surfaces.
- Migrating existing local SQLite data (dropped per decision).

## Self-review notes (coverage vs. spec)

- Spec A1 (Postgres) → Task A1. Spec A2 (Resend, close leak) → Tasks A3 + A4. Spec A3 (rate limiting) → Tasks A2 + A4. Spec A4 (security headers/CSP) → Task B3 (safe subset; full CSP deferred, as the spec flagged). Spec A5 (standalone) → intentionally dropped (documented in B1).
- Spec B (Dockerfile/compose/Caddyfile) → Tasks B1–B3, verified by B4.
- Spec C (provision/go-live) → Tasks C1–C2.
- Spec D (backups, metrics token; CI/CD + Sentry deferred) → Tasks D1–D2.
