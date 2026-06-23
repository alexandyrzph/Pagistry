# Design: Ship dnd-pagebuilder to production on a free Oracle VM

- **Date:** 2026-06-23
- **Status:** Approved (design) — pending spec review
- **Goal:** Get the app live in production **fast** and **as close to free as possible**, without reshaping features.

## Objective & constraints

Take the current feature-complete page builder from "runs on localhost with SQLite" to "publicly reachable, HTTPS, production-grade-enough to invite real users," optimizing for:

1. **Cost** — effectively $0/month (only cost is a cheap domain, ~$1–12/yr).
2. **Speed to launch** — minimal code reshaping; keep every existing feature working.
3. **Commercial use allowed** — rules out non-commercial free tiers (e.g. Vercel Hobby).

## Locked decisions

| Decision      | Choice                                                      | Why |
| ------------- | ---------------------------------------------------------- | --- |
| Host          | **Oracle Cloud "Always Free" A1 VM** (ARM Ampere, Ubuntu) | Genuinely $0 forever, commercial-use OK, full Node runtime → no feature reshaping |
| Runtime       | **Docker Compose** (caddy + app + postgres)               | Reproducible, one-command deploy, isolates services |
| Database      | **PostgreSQL 16 in a container** on the same VM           | Robust under concurrency, clean path to scale later; still $0 |
| Existing data | **Dropped** — fresh DB, schema-only                       | User confirmed; no data migration needed |
| Uploads       | **Local disk on a persistent Docker volume**             | Single VM has a persistent filesystem → object storage unnecessary |
| TLS / proxy   | **Caddy** (auto Let's Encrypt + existing on-demand TLS)   | Already configured in `ops/Caddyfile`; free certs |
| Domain        | **Buy a cheap real domain** (~$1–12/yr)                   | Required for HTTPS + the custom-domains feature |
| Email         | **Resend** (free tier: 3k/mo, 100/day, verified domain)  | Closes the password-reset hole; cheapest reliable deliverability |
| Rate limiting | **In-memory limiter**                                     | Single instance → no Redis needed |
| Secrets       | **`.env` on the box, chmod 600**                          | Single instance → no secret manager needed |
| CI/CD         | **Deferred to after first launch**                        | User confirmed; manual deploy for v1 |

## Architecture

```
Internet ──80/443──▶ Caddy ──reverse_proxy──▶ app (Next.js 16 standalone, Node)
                      │  auto TLS (main domain)              │ DATABASE_URL
                      │  on-demand TLS (customer domains)    ▼
                      │                                   postgres:16
                      ▼
              caddy_data volume (certs)

Persistent volumes:
  - pg_data     → postgres data
  - uploads     → mounted at /app/public/uploads (user assets)
  - caddy_data  → issued TLS certificates
```

- **One VM, three containers.** Caddy terminates TLS and reverse-proxies to the app on an internal network. The app talks to Postgres over the compose network. No ports exposed except 80/443.
- The existing `app/api/internal/health` route (DB `SELECT 1` → 200/503) drives the Docker healthcheck.

## Cost summary

| Item            | Cost |
| --------------- | ---- |
| Oracle A1 VM    | $0 (Always Free) |
| PostgreSQL      | $0 (self-hosted container) |
| Upload storage  | $0 (local volume) |
| TLS certs       | $0 (Let's Encrypt via Caddy) |
| Email (Resend)  | $0 (free tier) |
| Domain          | ~$1–12/yr |
| **Total**       | **≈ a few dollars per year** |

## Workstreams

### A. App-readiness code changes (local, behind the fallow/tsc/vitest/lint gate)

- **A1. Postgres provider switch.** Change `prisma/schema.prisma` datasource `provider` from `sqlite` to `postgresql`. Generate the **first real migration** (`prisma migrate dev`), replacing the `db push` workflow with a committed `prisma/migrations/` history. JSON columns stay as `String`/`text` (no conversion); both enums port cleanly. No data migration — fresh DB.
- **A2. Transactional email (Resend).** Add `lib/email/` (Resend client + a `sendPasswordReset` and `sendWorkspaceInvite`). Wire into `app/api/auth/forgot/route.ts` and the invite flow. **Delete the `resetUrl`-in-response body and the `console.log` of the reset link** — this is currently a security hole. New env: `RESEND_API_KEY`, `EMAIL_FROM`.
- **A3. Rate limiting.** Add a small in-memory token-bucket limiter (`lib/rate-limit.ts`) returning HTTP 429 on: `auth/login`, `auth/signup`, `auth/forgot`, `ai`, `upload`. Counters reset on restart — acceptable for a single instance.
- **A4. Security headers / CSP.** Add via Caddy `header` directive: HSTS, `X-Content-Type-Options`, `X-Frame-Options` (app/editor), and a Content-Security-Policy. **Caveat:** published user pages render arbitrary HTML via Embed/Code blocks, so CSP must be scoped — a strict policy for the app/editor surface, and a deliberately looser (or sandboxed-iframe) policy for the rendered-page surface. Get the editor locked down first; treat published-page CSP as best-effort for v1.
- **A5. Standalone output.** Set `output: "standalone"` in `next.config.ts` for a small runtime image.

### B. Containerization

- **B1. Multi-stage ARM64 Dockerfile.**
  - *deps/builder* stage: install all deps, `prisma generate`, `next build` (standalone).
  - *runner* stage: copy standalone output + static + public; **install `playwright` and run `playwright install --with-deps chromium`** — Playwright is currently a **devDependency** but `lib/thumbnails/screenshot.ts` imports it at runtime, so the runner image must include it + Chromium + system libs. `--no-sandbox` is already passed in code.
  - Entrypoint runs `prisma migrate deploy` then starts the standalone server.
- **B2. docker-compose.yml.** Services: `caddy`, `app`, `postgres`. Healthchecks (app → `/api/internal/health`, postgres → `pg_isready`), `restart: unless-stopped`, named volumes (`pg_data`, `uploads`, `caddy_data`), internal network, `depends_on` ordering.
- **B3. Parameterize Caddyfile.** Replace hardcoded `pagistry.com` with an env-driven domain (Caddy env-var substitution) so the same file works for any domain. Keep the existing `on_demand_tls` → `/api/domains/check` block for customer custom domains.

### C. Provisioning & go-live (runbook)

- **C1.** Buy the domain.
- **C2.** Create Oracle account → **upgrade to Pay-As-You-Go** (still $0 under Always-Free limits; prevents idle reclamation) → launch an **Always Free A1.Flex** VM (Ubuntu 22.04 ARM). Open ports 80/443 in the VCN security list **and** `ufw`.
- **C3.** Install Docker + compose plugin on the VM.
- **C4.** Generate strong secrets on the box: `AUTH_SECRET`, `THUMBNAIL_SECRET`, `METRICS_TOKEN`, Postgres password. Create `.env` (chmod 600). Add `RESEND_API_KEY`, `EMAIL_FROM`, `DATABASE_URL` (points at the `postgres` service), `APP_URL`.
- **C5.** Point the domain's **A record → VM public IP** (and `www`). Verify the Resend domain (DKIM/SPF records).
- **C6.** `docker compose up -d --build`. Caddy auto-issues TLS. `migrate deploy` creates the schema on first boot.
- **C7.** Create the first user/workspace/site through the live UI.

### D. Keep-it-alive (cheap ops, day-after-launch)

- **D1.** Nightly `pg_dump` cron → a backups volume; optionally `rclone` a copy to Backblaze B2 (10GB free) or similar off-box target.
- **D2.** Enforce `METRICS_TOKEN` on `/api/internal/metrics` (confirm it's required, not optional, in production).
- **D3.** *(Deferred — explicitly out of scope for launch)* GitHub Actions CI/CD (gate → build image to GHCR → SSH deploy) and Sentry free-tier error alerting.

## Sequencing

**A → B → C** to go live, then **D** for hardening. A is the bulk of the work (code); B and C are mostly new infra files + a provisioning runbook; D happens after the site is up.

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Oracle A1 "out of capacity" in popular regions | Retry, or choose a less-busy home region; A1 is the constrained shape |
| Oracle reclaims idle Always-Free VM | Upgrade account to Pay-As-You-Go (stays $0 under limits) |
| ARM64 build issues (Playwright/Chromium) | Pin an ARM64-compatible base; Playwright ships ARM Chromium; verify in build |
| Playwright missing in prod image | Explicitly install it + Chromium in the runner stage (see B1) |
| Single VM = no HA | Acceptable at launch; nightly backups (D1) mitigate data loss |
| Published-page CSP vs user embeds | Strict CSP on editor; looser/sandboxed for rendered pages; iterate post-launch |

## Out of scope (deferred)

- CI/CD pipeline and Sentry (D3).
- High availability / multi-instance / managed Postgres.
- Object storage / CDN for uploads (local volume is fine at launch).
- Migrating existing local SQLite data (dropped per decision).

## Success criteria

1. App reachable at `https://<domain>` with a valid auto-issued TLS cert.
2. Signup → login → create site → add page → publish → view published page all work end-to-end.
3. Password reset sends a real email (no link leaked in the response).
4. Thumbnail generation works (Playwright/Chromium in the image).
5. `scripts/verify.mjs` smoke test passes against the live URL.
6. A custom domain added through the UI gets on-demand TLS via Caddy.
7. Nightly DB backup produces a restorable dump.
