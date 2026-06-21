# Custom Domains (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a site attach its own domain (e.g. `acme.com`) so its published content serves there — `acme.com/` → the site's home page, `acme.com/about` → its `about` page, `acme.com/c/blog/<item>` → a CMS detail — driven entirely by the request `Host`.

**Architecture:** A new `Domain` model (FK `siteId`, `hostname @unique`, status `PENDING→VERIFYING→ACTIVE→ERROR`). Ownership is proven by a DNS TXT record (Node `dns/promises`). `proxy.ts` gains a pure, **Prisma-free** host test: a custom host (not `APP_PRIMARY_HOST`) gets its path rewritten (`/`→`/p/__home__`, `/about`→`/p/about`; `/api`,`/c`,`/_next` pass through) and skips the auth gate. The Node render layer resolves Host→Domain→Site (`lib/domains/resolve.ts`, React-cached) and host-scopes the page lookup by `{ siteId, slug }`. A `GET /api/domains/check` ask-endpoint gates Caddy on-demand TLS. Domains are managed via `/api/domains` (ADMIN+ on the active site); the settings UI is deferred to a fast-follow.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Prisma 6 + SQLite, Node `dns/promises`, Caddy (on-demand TLS, ops config only), Vitest (node env), TypeScript strict, ESLint flat + Prettier.

**Spec:** `docs/superpowers/specs/2026-06-21-custom-domains-design.md` · **Builds on:** the merged multi-site model (`Site` first-class, `Domain.siteId`, `lib/auth/site.ts`, `withSite`/`withSiteRole`).

## Global Constraints

- **This is NOT vanilla Next.js** — read the relevant guide under `node_modules/next/dist/docs/` before using a Next API. Middleware is `proxy.ts`.
- **`proxy.ts` must do ZERO DB work** — only a pure string host test. The Host→Site lookup happens in the Node render layer (`headers()` + Prisma + React `cache`). Never import Prisma into `proxy.ts`.
- **Read the host from `x-forwarded-host` (set by Caddy) falling back to `host`** — both in the proxy and the render layer. Do not trust a client-supplied `x-forwarded-host` outside the Caddy hop (acceptable for P1: the app is only reachable through Caddy in prod; in dev there is no Caddy and `host` is used).
- **Schema** applied with `npx prisma db push` then `npx prisma generate`; **restart `next dev`** after (cached Prisma client won't see the new `domain` delegate otherwise).
- **Gate (before every commit):** `npx tsc --noEmit` && `npx vitest run` && `npx eslint .` && `npx prettier --check .`. Not `next build` while `next dev` runs.
- **Code style:** no `eslint-disable`, no `any`/`as any`/`!`, **no explanatory/justification comments**; match existing style (double quotes, semicolons, 2-space).
- **Client HTTP** via `lib/api/client` (`api`) with paths from `lib/api/endpoints.ts`. (The ask-endpoint is called by Caddy server-to-server, not the axios client, but still registered.)
- **New env:** `APP_PRIMARY_HOST` (the app's own host, e.g. `pagecraft.app`; defaults to `localhost` in dev), `PAGECRAFT_CNAME_TARGET` (the CNAME the customer points `www` at; defaults to `cname.pagecraft.app`). Commit `prisma/dev.db` is excluded from every commit (`git reset -q -- prisma/dev.db .idea`).

---

## File Structure

**Create:**

- `lib/domains/host.ts` — pure host helpers: `normalizeHost`, `appHost`, `isAppHost`, `customDomainRewrite`, `dnsInstructions`.
- `lib/domains/validate.ts` — `validateHostname(input)` → `{ hostname }` | `{ error }`.
- `lib/domains/verify.ts` — `verifyDns(hostname, token)` (Node `dns/promises`).
- `lib/domains/resolve.ts` — `lookupHostSite(host)` (testable) + `resolveHostSite = cache(lookupHostSite)`.
- `app/api/domains/route.ts` — `GET` list / `POST` add (ADMIN+).
- `app/api/domains/[id]/route.ts` — `DELETE` (ADMIN+).
- `app/api/domains/[id]/verify/route.ts` — `POST` verify (ADMIN+).
- `app/api/domains/check/route.ts` — `GET` ask-endpoint (no auth, loopback).
- `ops/Caddyfile` — documented on-demand-TLS reverse-proxy config.
- Tests: `tests/domains-host.test.ts`, `tests/domains-validate.test.ts`, `tests/domains-verify.test.ts`, `tests/domains-resolve.test.ts`, `tests/domains-check.test.ts`, `tests/domains-api.test.ts`.

**Modify:**

- `prisma/schema.prisma` — `DomainStatus` enum + `Domain` model + `Site.domains` back-relation.
- `proxy.ts` — custom-host detection + path rewrite (before the auth gate).
- `app/p/[slug]/page.tsx` — host-scoped page lookup + `__home__` sentinel.
- `app/c/[slug]/[item]/page.tsx` — host-scoped collection lookup + assertion.
- `lib/api/endpoints.ts` — `endpoints.domains.*`.

**Deferred to a fast-follow plan (P1.5):** the per-site **Domains settings page** (add/verify/remove/set-primary UI). For P1, domains are managed via the API (curl/tests).

---

## Task 1: `Domain` model + schema

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum + model + back-relation**

In `prisma/schema.prisma`, add the enum and model (place near the other enums/models), and add `domains Domain[]` to the existing `Site` model's relation block:

```prisma
enum DomainStatus {
  PENDING
  VERIFYING
  ACTIVE
  ERROR
}

model Domain {
  id                String       @id @default(cuid())
  siteId            String
  site              Site         @relation(fields: [siteId], references: [id], onDelete: Cascade)
  hostname          String       @unique
  status            DomainStatus @default(PENDING)
  verificationToken String       @default(cuid())
  verifiedAt        DateTime?
  isPrimary         Boolean      @default(false)
  redirectToPrimary Boolean      @default(true)
  lastCheckedAt     DateTime?
  lastError         String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([siteId])
}
```

In `model Site { … }`, add the back-relation alongside `pages`/`collections`/`assets`/`components`:

```prisma
  domains Domain[]
```

- [ ] **Step 2: Push + regenerate**

```bash
npx prisma db push && npx prisma generate
```

Expected: "in sync" + "Generated Prisma Client". (Restart `next dev` if it's running.)

- [ ] **Step 3: Confirm the delegate exists**

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.domain.count().then((n)=>{console.log('domain delegate ok:', n); return p.\$disconnect()})"
```

Expected: `domain delegate ok: 0`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Domain model (siteId FK, hostname unique, status lifecycle)"
```

---

## Task 2: Host helpers (`lib/domains/host.ts`)

Pure functions: host normalization, app-host classification, the proxy rewrite decision, and DNS-instruction building. All unit-testable, no I/O.

**Files:**

- Create: `lib/domains/host.ts`
- Test: `tests/domains-host.test.ts`

**Interfaces:**

- Produces: `normalizeHost(raw: string): string`, `appHost(): string`, `isAppHost(host: string): boolean`, `customDomainRewrite(pathname: string): string | null`, `dnsInstructions(hostname: string, token: string): { ownership: { record: string; type: "TXT"; value: string }; routing: { record: string; type: "A" | "CNAME"; value: string } }`.

- [ ] **Step 1: Write the failing tests**

`tests/domains-host.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { normalizeHost, isAppHost, customDomainRewrite, dnsInstructions } from "@/lib/domains/host";

describe("normalizeHost", () => {
  it("lowercases and strips scheme, path, port, and trailing dot", () => {
    expect(normalizeHost("HTTPS://Acme.com:443/about/")).toBe("acme.com");
    expect(normalizeHost("acme.com.")).toBe("acme.com");
    expect(normalizeHost("  WWW.Acme.COM  ")).toBe("www.acme.com");
  });
});

describe("isAppHost", () => {
  beforeEach(() => {
    process.env.APP_PRIMARY_HOST = "pagecraft.app";
  });
  it("treats the configured app host (and its www), localhost, and empty as app hosts", () => {
    expect(isAppHost("pagecraft.app")).toBe(true);
    expect(isAppHost("www.pagecraft.app")).toBe(true);
    expect(isAppHost("localhost:3000")).toBe(true);
    expect(isAppHost("127.0.0.1")).toBe(true);
    expect(isAppHost("")).toBe(true);
  });
  it("treats a customer domain as NOT the app host", () => {
    expect(isAppHost("acme.com")).toBe(false);
    expect(isAppHost("blog.acme.com")).toBe(false);
  });
});

describe("customDomainRewrite", () => {
  it("maps / to the home sentinel and a bare slug under /p", () => {
    expect(customDomainRewrite("/")).toBe("/p/__home__");
    expect(customDomainRewrite("/about")).toBe("/p/about");
  });
  it("passes through api, next internals, assets, and already-prefixed render paths", () => {
    for (const p of [
      "/api/x",
      "/_next/static/x",
      "/c/blog/1",
      "/p/about",
      "/internal/x",
      "/logo.png",
    ]) {
      expect(customDomainRewrite(p)).toBeNull();
    }
  });
});

describe("dnsInstructions", () => {
  beforeEach(() => {
    process.env.PAGECRAFT_CNAME_TARGET = "cname.pagecraft.app";
  });
  it("builds the ownership TXT and a CNAME for a subdomain", () => {
    const i = dnsInstructions("www.acme.com", "tok123");
    expect(i.ownership).toEqual({
      record: "_pagecraft-verify.www.acme.com",
      type: "TXT",
      value: "pagecraft-domain-verification=tok123",
    });
    expect(i.routing).toEqual({
      record: "www.acme.com",
      type: "CNAME",
      value: "cname.pagecraft.app",
    });
  });
  it("uses an A record for an apex domain", () => {
    expect(dnsInstructions("acme.com", "t").routing.type).toBe("A");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`@/lib/domains/host` missing)

Run: `npx vitest run tests/domains-host.test.ts`

- [ ] **Step 3: Implement `lib/domains/host.ts`**

```ts
const LOCAL = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function appHost(): string {
  return normalizeHost(process.env.APP_PRIMARY_HOST || "localhost");
}

export function isAppHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h || LOCAL.has(h)) return true;
  const app = appHost();
  return h === app || h === `www.${app}` || `www.${h}` === app;
}

const PASSTHROUGH = ["/api", "/_next", "/c/", "/p/", "/internal/"];

export function customDomainRewrite(pathname: string): string | null {
  if (pathname === "/") return "/p/__home__";
  if (PASSTHROUGH.some((p) => pathname.startsWith(p)) || /\.[a-z0-9]+$/i.test(pathname)) {
    return null;
  }
  return `/p${pathname}`;
}

export function dnsInstructions(hostname: string, token: string) {
  const isApex = hostname.split(".").length <= 2;
  const cnameTarget = process.env.PAGECRAFT_CNAME_TARGET || "cname.pagecraft.app";
  return {
    ownership: {
      record: `_pagecraft-verify.${hostname}`,
      type: "TXT" as const,
      value: `pagecraft-domain-verification=${token}`,
    },
    routing: isApex
      ? {
          record: hostname,
          type: "A" as const,
          value: process.env.PAGECRAFT_SERVER_IP || "<server-ip>",
        }
      : { record: hostname, type: "CNAME" as const, value: cnameTarget },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/domains-host.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/domains/host.ts tests/domains-host.test.ts
git commit -m "feat(domains): host normalization, app-host test, proxy rewrite, DNS instructions"
```

---

## Task 3: Hostname validation (`lib/domains/validate.ts`)

**Files:**

- Create: `lib/domains/validate.ts`
- Test: `tests/domains-validate.test.ts`

**Interfaces:**

- Produces: `validateHostname(input: string): { hostname: string } | { error: string }`.
- Consumes: `normalizeHost`, `isAppHost` from `@/lib/domains/host`.

- [ ] **Step 1: Write the failing tests**

`tests/domains-validate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { validateHostname } from "@/lib/domains/validate";

describe("validateHostname", () => {
  beforeEach(() => {
    process.env.APP_PRIMARY_HOST = "pagecraft.app";
  });
  it("accepts a normal domain and a subdomain (normalized)", () => {
    expect(validateHostname("Acme.com")).toEqual({ hostname: "acme.com" });
    expect(validateHostname("blog.acme.com")).toEqual({ hostname: "blog.acme.com" });
  });
  it("rejects empty, IPs, the app host, localhost, single-label, and malformed input", () => {
    expect("error" in validateHostname("")).toBe(true);
    expect("error" in validateHostname("127.0.0.1")).toBe(true);
    expect("error" in validateHostname("pagecraft.app")).toBe(true);
    expect("error" in validateHostname("localhost")).toBe(true);
    expect("error" in validateHostname("nodot")).toBe(true);
    expect("error" in validateHostname("bad host.com")).toBe(true);
    expect("error" in validateHostname("a".repeat(254) + ".com")).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domains-validate.test.ts`

- [ ] **Step 3: Implement `lib/domains/validate.ts`**

```ts
import { isAppHost, normalizeHost } from "@/lib/domains/host";

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|:/;

export function validateHostname(input: string): { hostname: string } | { error: string } {
  const hostname = normalizeHost(input);
  if (!hostname) return { error: "Enter a domain" };
  if (IP_RE.test(hostname)) return { error: "IP addresses are not allowed" };
  if (isAppHost(hostname)) return { error: "That host is reserved" };
  if (hostname.split(".").length < 2) return { error: "Enter a full domain (e.g. acme.com)" };
  if (!HOSTNAME_RE.test(hostname)) return { error: "That is not a valid domain" };
  return { hostname };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/domains-validate.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/domains/validate.ts tests/domains-validate.test.ts
git commit -m "feat(domains): hostname validation (reject IPs, app host, malformed)"
```

---

## Task 4: DNS ownership verification (`lib/domains/verify.ts`)

**Files:**

- Create: `lib/domains/verify.ts`
- Test: `tests/domains-verify.test.ts`

**Interfaces:**

- Produces: `verifyDns(hostname: string, token: string): Promise<{ ok: boolean; ownership: boolean; routing: boolean; error: string | null }>`.

- [ ] **Step 1: Write the failing tests (mock `dns/promises`)**

`tests/domains-verify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveTxt = vi.fn();
const resolveCname = vi.fn();
vi.mock("dns/promises", () => ({ resolveTxt, resolveCname }));

import { verifyDns } from "@/lib/domains/verify";

beforeEach(() => {
  resolveTxt.mockReset();
  resolveCname.mockReset();
  process.env.PAGECRAFT_CNAME_TARGET = "cname.pagecraft.app";
});

describe("verifyDns", () => {
  it("ok when the TXT token matches (ownership) regardless of routing", async () => {
    resolveTxt.mockResolvedValue([["pagecraft-domain-verification=tok"]]);
    resolveCname.mockRejectedValue(new Error("ENODATA"));
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(true);
    expect(r.ownership).toBe(true);
    expect(r.error).toBeNull();
  });
  it("fails when the TXT token mismatches", async () => {
    resolveTxt.mockResolvedValue([["pagecraft-domain-verification=other"]]);
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(false);
    expect(r.ownership).toBe(false);
    expect(r.error).toMatch(/ownership/i);
  });
  it("fails cleanly when the TXT record is missing (ENOTFOUND)", async () => {
    resolveTxt.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ownership/i);
  });
  it("reports routing true when CNAME points at the target", async () => {
    resolveTxt.mockResolvedValue([["pagecraft-domain-verification=tok"]]);
    resolveCname.mockResolvedValue(["cname.pagecraft.app"]);
    const r = await verifyDns("www.acme.com", "tok");
    expect(r.routing).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domains-verify.test.ts`

- [ ] **Step 3: Implement `lib/domains/verify.ts`**

```ts
import { resolveTxt, resolveCname } from "dns/promises";

export async function verifyDns(
  hostname: string,
  token: string,
): Promise<{ ok: boolean; ownership: boolean; routing: boolean; error: string | null }> {
  const expected = `pagecraft-domain-verification=${token}`;
  let ownership = false;
  try {
    const records = await resolveTxt(`_pagecraft-verify.${hostname}`);
    ownership = records.some((parts) => parts.join("").includes(expected));
  } catch {
    ownership = false;
  }

  let routing = false;
  try {
    const target = (process.env.PAGECRAFT_CNAME_TARGET || "cname.pagecraft.app").toLowerCase();
    const cnames = await resolveCname(hostname);
    routing = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === target);
  } catch {
    routing = false;
  }

  return {
    ok: ownership,
    ownership,
    routing,
    error: ownership ? null : "Ownership TXT record not found or token mismatch",
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/domains-verify.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/domains/verify.ts tests/domains-verify.test.ts
git commit -m "feat(domains): DNS ownership verification via dns/promises"
```

---

## Task 5: Host → site resolver (`lib/domains/resolve.ts`)

**Files:**

- Create: `lib/domains/resolve.ts`
- Test: `tests/domains-resolve.test.ts`

**Interfaces:**

- Produces: `lookupHostSite(host: string): Promise<{ siteId: string; site: Site; domain: Domain } | null>` and `resolveHostSite = cache(lookupHostSite)`.
- Consumes: `normalizeHost` from `@/lib/domains/host`.

- [ ] **Step 1: Write the failing test (real DB)**

`tests/domains-resolve.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { lookupHostSite } from "@/lib/domains/resolve";

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("lookupHostSite", () => {
  it("returns the site for an ACTIVE host and null otherwise", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "active.example", status: "ACTIVE" },
    });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "pending.example", status: "PENDING" },
    });

    const active = await lookupHostSite("HTTPS://Active.example/");
    expect(active?.siteId).toBe(site.id);
    expect(await lookupHostSite("pending.example")).toBeNull();
    expect(await lookupHostSite("unknown.example")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domains-resolve.test.ts`

- [ ] **Step 3: Implement `lib/domains/resolve.ts`**

```ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/domains/host";

export async function lookupHostSite(host: string) {
  const hostname = normalizeHost(host);
  if (!hostname) return null;
  const domain = await prisma.domain.findUnique({ where: { hostname }, include: { site: true } });
  if (!domain || domain.status !== "ACTIVE") return null;
  return { siteId: domain.siteId, site: domain.site, domain };
}

export const resolveHostSite = cache(lookupHostSite);
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/domains-resolve.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/domains/resolve.ts tests/domains-resolve.test.ts
git commit -m "feat(domains): resolveHostSite (Host -> ACTIVE Domain -> Site)"
```

---

## Task 6: Ask-endpoint (`GET /api/domains/check`) + endpoints registry

**Files:**

- Create: `app/api/domains/check/route.ts`
- Modify: `lib/api/endpoints.ts`
- Test: `tests/domains-check.test.ts`

**Interfaces:**

- Consumes: `lookupHostSite` is NOT used here (the ask endpoint checks status directly); `normalizeHost` from `@/lib/domains/host`.

- [ ] **Step 1: Write the failing test (calls the GET handler directly, real DB)**

`tests/domains-check.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET } from "@/app/api/domains/check/route";

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

function req(host: string) {
  return new Request(`http://localhost/api/domains/check?domain=${encodeURIComponent(host)}`);
}

describe("GET /api/domains/check", () => {
  it("200 for an ACTIVE host, 403 otherwise", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "ask-active.example", status: "ACTIVE" },
    });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "ask-pending.example", status: "PENDING" },
    });

    expect((await GET(req("ASK-Active.example"))).status).toBe(200);
    expect((await GET(req("ask-pending.example"))).status).toBe(403);
    expect((await GET(req("nope.example"))).status).toBe(403);
    expect((await GET(req(""))).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domains-check.test.ts`

- [ ] **Step 3: Implement `app/api/domains/check/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hostname = normalizeHost(new URL(req.url).searchParams.get("domain") ?? "");
  if (!hostname) return new Response(null, { status: 403 });
  const domain = await prisma.domain.findUnique({ where: { hostname } });
  return new Response(null, { status: domain?.status === "ACTIVE" ? 200 : 403 });
}
```

- [ ] **Step 4: Register endpoints**

In `lib/api/endpoints.ts`, add to the `endpoints` object:

```ts
  domains: {
    list: "/api/domains",
    byId: (id: string) => `/api/domains/${id}`,
    verify: (id: string) => `/api/domains/${id}/verify`,
    check: (host: string) => `/api/domains/check?domain=${encodeURIComponent(host)}`,
  },
```

- [ ] **Step 5: Run — expect PASS, then gate**

Run: `npx vitest run tests/domains-check.test.ts && npx tsc --noEmit && npx eslint app/api/domains lib/api/endpoints.ts`

- [ ] **Step 6: Commit**

```bash
git add app/api/domains/check lib/api/endpoints.ts tests/domains-check.test.ts
git commit -m "feat(domains): Caddy ask-endpoint (200 for ACTIVE host) + endpoints registry"
```

---

## Task 7: Domains API (add / list / delete / verify)

All scoped to the **active site** (`withSite`/`withSiteRole("ADMIN")` from the multi-site model); by-id routes assert the domain belongs to the active site.

**Files:**

- Create: `app/api/domains/route.ts`, `app/api/domains/[id]/route.ts`, `app/api/domains/[id]/verify/route.ts`
- Test: `tests/domains-api.test.ts`

**Interfaces:**

- Consumes: `withSite`, `withSiteRole` from `@/lib/api/api-handler`; `json`, `created`, `badRequest`, `notFound` from `@/lib/api/api-response`; `validateHostname` from `@/lib/domains/validate`; `verifyDns` from `@/lib/domains/verify`; `dnsInstructions` from `@/lib/domains/host`.

- [ ] **Step 1: Write the failing test (exercises validation + uniqueness; verify is covered in Task 4)**

`tests/domains-api.test.ts`:

```ts
import { describe, it, expect, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/api/api-handler", () => ({
  withSite: (fn: (c: { site: { id: string } }) => unknown) =>
    fn({ site: { id: globalThis.__siteId } }),
  withSiteRole: (_min: string, fn: (c: { site: { id: string } }) => unknown) =>
    fn({ site: { id: globalThis.__siteId } }),
}));

declare global {
  // eslint-disable-next-line no-var
  var __siteId: string;
}

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("POST /api/domains", () => {
  it("rejects an invalid host, creates a valid one, and 409s a duplicate", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    globalThis.__siteId = site.id;
    const { POST } = await import("@/app/api/domains/route");

    const bad = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: "127.0.0.1" }),
      }),
    );
    expect(bad.status).toBe(400);

    const ok = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: `d-${Date.now()}.example` }),
      }),
    );
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.domain.status).toBe("PENDING");
    expect(body.dns.ownership.type).toBe("TXT");

    const dupHost = body.domain.hostname;
    const dup = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: dupHost }),
      }),
    );
    expect(dup.status).toBe(409);
  });
});
```

(The note in this test's `eslint-disable` is illustrative; replace `var`+`globalThis.__siteId` with whatever mock-injection pattern the existing suite prefers — see `tests/page-thumbnail.dom.test.tsx`'s `vi.mock` of `@/lib/api/client`. The goal: stub `withSite`/`withSiteRole` to invoke the handler with a known `site.id`. Do NOT leave an `eslint-disable` in the final test.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/domains-api.test.ts`

- [ ] **Step 3: Implement the routes**

`app/api/domains/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, created, badRequest } from "@/lib/api/api-response";
import { validateHostname } from "@/lib/domains/validate";
import { dnsInstructions } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const domains = await prisma.domain.findMany({
      where: { siteId: ctx.site.id },
      orderBy: { createdAt: "asc" },
    });
    return json(domains);
  });
}

export async function POST(req: Request) {
  return withSiteRole("ADMIN", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const result = validateHostname(String(body?.hostname ?? ""));
    if ("error" in result) return badRequest(result.error);
    const existing = await prisma.domain.findUnique({ where: { hostname: result.hostname } });
    if (existing) return json({ error: "That domain is already in use" }, 409);
    const domain = await prisma.domain.create({
      data: { siteId: ctx.site.id, hostname: result.hostname },
    });
    return created({ domain, dns: dnsInstructions(domain.hostname, domain.verificationToken) });
  });
}
```

`app/api/domains/[id]/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("ADMIN", async (ctx) => {
    const domain = await prisma.domain.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!domain) return notFound();
    await prisma.domain.delete({ where: { id } });
    return json({ ok: true });
  });
}
```

`app/api/domains/[id]/verify/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";
import { verifyDns } from "@/lib/domains/verify";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("ADMIN", async (ctx) => {
    const domain = await prisma.domain.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!domain) return notFound();
    await prisma.domain.update({
      where: { id },
      data: { status: "VERIFYING", lastCheckedAt: new Date() },
    });
    const result = await verifyDns(domain.hostname, domain.verificationToken);
    const updated = await prisma.domain.update({
      where: { id },
      data: result.ok
        ? { status: "ACTIVE", verifiedAt: new Date(), lastError: null }
        : { status: "ERROR", lastError: result.error },
    });
    return json({ domain: updated, routing: result.routing });
  });
}
```

- [ ] **Step 4: Run — expect PASS, then gate**

Run: `npx vitest run tests/domains-api.test.ts && npx tsc --noEmit && npx eslint app/api/domains`

- [ ] **Step 5: Commit**

```bash
git add app/api/domains tests/domains-api.test.ts
git commit -m "feat(domains): /api/domains add/list/delete/verify (ADMIN+, active-site scoped)"
```

---

## Task 8: Proxy host-routing

`proxy.ts` gains a custom-host branch (pure, Prisma-free) before the auth gate.

**Files:**

- Modify: `proxy.ts`

- [ ] **Step 1: Add the custom-domain branch**

In `proxy.ts`, add the import and the branch at the very top of the `proxy` function (before the existing `/api`,`/p/`,… early return):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { isAppHost, customDomainRewrite } from "@/lib/domains/host";

const AUTH_PAGES = ["/login", "/signup", "/forgot", "/reset"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!isAppHost(host)) {
    const rewriteTo = customDomainRewrite(pathname);
    if (!rewriteTo) return NextResponse.next();
    return NextResponse.rewrite(new URL(rewriteTo, req.url));
  }

  // …existing app-host logic unchanged (early-return for /api,/p/,/c/,/internal,
  //   auth-page handling, session gate)…
```

Keep the rest of the function exactly as it is.

- [ ] **Step 2: Verify the proxy decision via its pure helpers**

The branch is built from `isAppHost` + `customDomainRewrite`, both already unit-tested in Task 2. Run those tests plus the gate:

Run: `npx vitest run tests/domains-host.test.ts && npx tsc --noEmit && npx eslint proxy.ts`
Expected: pass; 0 errors. (Optionally smoke-test by setting `APP_PRIMARY_HOST=localhost` and hitting the dev server with `curl -H 'x-forwarded-host: acme.com' localhost:3000/about -I` → should internally rewrite to `/p/about`.)

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(domains): proxy routes custom hosts (rewrite path, skip auth gate)"
```

---

## Task 9: Host-scoped public render

Make `/p/[slug]` and `/c/[slug]/[item]` derive the site from the host, scope the lookup by `{ siteId, slug }`, assert ownership, and serve the home page for the `__home__` sentinel.

**Files:**

- Modify: `app/p/[slug]/page.tsx`, `app/c/[slug]/[item]/page.tsx`

- [ ] **Step 1: Add a request-host helper**

Append to `lib/domains/host.ts`:

```ts
import { headers } from "next/headers";

export async function requestHost(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-host") ?? h.get("host") ?? "";
}
```

(`headers` is a server-only import; this module is only imported by server code and the proxy, which uses the other pure exports — keep `requestHost` as the only function touching `headers`.)

- [ ] **Step 2: Host-scope `app/p/[slug]/page.tsx`**

Replace its body with host-aware resolution. The rule: on a **custom domain** (`resolveHostSite` non-null) look up `{ siteId, slug }` and serve the `__home__` sentinel from `Site.homePageId`; on the **app host** keep the legacy `findFirst({ slug })` preview path (and 404 `__home__`).

```ts
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageDocument } from "@/components/PageDocument";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

async function loadPage(slug: string) {
  const resolved = await resolveHostSite(await requestHost());
  if (slug === "__home__") {
    if (!resolved?.site.homePageId) return null;
    return prisma.page.findUnique({ where: { id: resolved.site.homePageId } });
  }
  if (resolved) return prisma.page.findFirst({ where: { siteId: resolved.siteId, slug } });
  return prisma.page.findFirst({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: "Page not found" };
  const title = page.metaTitle || page.title;
  const description = page.metaDescription || undefined;
  const images = page.ogImage ? [page.ogImage] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page || !page.published) notFound();
  return <PageDocument page={page} />;
}
```

(This drops the hardcoded `https://pagecraft.app` JSON-LD block — the canonical/OG-by-primary-domain work is explicitly P2. Removing the stale hardcoded URL now is correct; re-adding a host-correct one is the P2 task.)

- [ ] **Step 3: Host-scope `app/c/[slug]/[item]/page.tsx`**

Change `load` to resolve the host and scope the collection by `{ siteId, slug }`, returning null when the host doesn't resolve to a site that owns the collection. Replace the `load` function (lines 13–19):

```ts
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/host";

async function load(slug: string, itemId: string) {
  const resolved = await resolveHostSite(await requestHost());
  const collection = resolved
    ? await prisma.collection.findFirst({ where: { siteId: resolved.siteId, slug } })
    : await prisma.collection.findFirst({ where: { slug } });
  if (!collection || !collection.detailEnabled) return null;
  const item = await prisma.collectionItem.findUnique({ where: { id: itemId } });
  if (!item || item.collectionId !== collection.id) return null;
  return { collection, item };
}
```

The rest of the file is unchanged (it already derives `siteId` from `found.collection.siteId` and scopes header/footer/components/collections by it).

- [ ] **Step 4: Run the FULL gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`
Expected: tsc 0 errors; all tests pass; eslint + prettier clean.

- [ ] **Step 5: Commit**

```bash
git add app/p/[slug]/page.tsx app/c/[slug]/[item]/page.tsx lib/domains/host.ts
git commit -m "feat(domains): host-scoped public render + __home__ sentinel"
```

---

## Task 10: Caddy config + integration verification

**Files:**

- Create: `ops/Caddyfile`

- [ ] **Step 1: Write the Caddy on-demand-TLS config**

`ops/Caddyfile` (ops/deploy artifact — not built/imported by the app):

```caddyfile
{
	on_demand_tls {
		ask http://127.0.0.1:3000/api/domains/check
	}
}

https:// {
	tls {
		on_demand
	}
	reverse_proxy 127.0.0.1:3000 {
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
	}
}

pagecraft.app, www.pagecraft.app {
	reverse_proxy 127.0.0.1:3000
}
```

- [ ] **Step 2: Final gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`
Expected: all green.

- [ ] **Step 3: Manual end-to-end (documented; not automated)**

With `APP_PRIMARY_HOST=localhost` and `next dev` running:

1. Sign in, create/select a site, publish its home page + an `about` page.
2. `curl -X POST localhost:3000/api/domains -H 'content-type: application/json' -d '{"hostname":"acme.test"}' --cookie '<session+pc_ws+pc_site>'` → returns the `PENDING` domain + DNS instructions.
3. Flip it ACTIVE for a local test: `npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.domain.update({where:{hostname:'acme.test'},data:{status:'ACTIVE'}}).then(()=>p.\$disconnect())"`.
4. `curl -H 'x-forwarded-host: acme.test' localhost:3000/ -i` → renders the site's home page; `-H 'x-forwarded-host: acme.test' localhost:3000/about` → the about page; an unknown host → 404. `GET /api/domains/check?domain=acme.test` → 200.

(Real TLS issuance requires Caddy + a public DNS record; that's a deploy step, not part of this gate.)

- [ ] **Step 4: Commit**

```bash
git add ops/Caddyfile
git commit -m "docs(domains): Caddy on-demand-TLS reverse-proxy config"
```

---

## Out of scope (follow-up plans)

- **Domains settings UI (P1.5):** the per-site add/verify/remove/set-primary page (consumes `endpoints.domains.*`). Deferred so P1 stays backend + routing (fully unit-testable); domains are managed via the API until then.
- **P2 — canonicalization & polish:** `isPrimary` + apex↔www `308` redirects, multiple domains per site, host-correct canonical/OG/JSON-LD (replacing the dropped hardcoded `pagecraft.app`), periodic re-verification cron, status-poll UI.
- **P3:** wildcard/DNS-01 domains, per-domain analytics, billing limits.

---

## Self-review notes

- **Spec coverage:** §3 model → Task 1; §4 verification (normalize/validate/DNS) → Tasks 2–4, 7; §5 routing (proxy + `resolveHostSite` + host-scoped render + `__home__`) → Tasks 5, 8, 9; §6 ask-endpoint + Caddyfile → Tasks 6, 10; §7 endpoints registry → Task 6; §8 security (ownership gate, `hostname @unique` 409, host-scoped render, reserved-host rejection) → Tasks 3, 7, 9. §7 **builder UI** is deferred (flagged). §9 apex/www `isPrimary` redirects are **P2** (the model has the columns; the redirect logic is deferred) — flagged so it isn't mistaken for missing P1 scope.
- **Type consistency:** `normalizeHost`/`isAppHost`/`customDomainRewrite`/`dnsInstructions` (Task 2) are consumed verbatim in Tasks 3, 6, 7, 8, 9; `validateHostname → { hostname } | { error }` (Task 3) in Task 7; `verifyDns → { ok, ownership, routing, error }` (Task 4) in Task 7; `lookupHostSite`/`resolveHostSite` (Task 5) in Tasks 6(no), 9; `requestHost` (Task 9 step 1) in Task 9 steps 2–3.
- **No placeholders:** every code step is complete. The `domains-api.test.ts` mock-injection pattern is called out as adaptable to the suite's existing `vi.mock` style, with an explicit "no eslint-disable in the final test" instruction.
- **Confirm at execution:** `lib/api/api-response.ts` exports `json(data, status?)`, `created`, `badRequest`, `notFound` (verified during multi-site work) — `json(body, 409)` is valid. `lib/auth/site.ts` exposes `withSite`/`withSiteRole` via `lib/api/api-handler.ts` (the active-site guards; domain routes scope by the active `ctx.site.id`).

```

```
