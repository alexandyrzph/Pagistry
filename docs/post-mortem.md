# Pagecraft — Performance Post-Mortem & Load-Test Report

**Status:** Living document · **Owner:** Platform · **Scope:** editor autosave,
dashboard, public render, AI generation

This is the engineering write-up of where Pagecraft hurt under load, how the
[observability stack](./observability.md) let us find each bottleneck, and what
we changed. It doubles as a load-testing runbook.

> **On the numbers.** Figures below come from the harness in
> [`scripts/load/`](../scripts/load) run against a local build (Apple M-series,
> 10 vCPU, SQLite). They are reproducible, not hand-waved — but absolute values
> will differ on your hardware. The *shapes* (where it breaks, and why) are what
> matter. Re-run the scripts to regenerate them for your environment.

---

## Executive summary

| # | Bottleneck | Symptom under load | Root cause | Fix | Result |
|---|-----------|--------------------|-----------|-----|--------|
| 1 | Dashboard list | p95 1.8s @ 50 VUs | N+1 queries (thumbnail per page) | single grouped query + indexed `workspaceId` | p95 1.8s → 120ms |
| 2 | Autosave writes | `SQLITE_BUSY` errors @ 100 VUs | SQLite default rollback journal, single writer | WAL mode + `busy_timeout` | 4.1% error → 0% |
| 3 | Autosave payload | p95 climbs with page size | full block-tree re-serialized + re-sent every keystroke-debounce | diff-aware debounce + gzip + server-side size guard | 38KB→3KB median write |
| 4 | Big-page render | event-loop stalls, slow TTFB | `styles.ts` rebuilt entire stylesheet O(blocks) per render, sync | memoized style cache keyed by block id+styles hash | TTFB 640ms → 180ms |
| 5 | AI generation | connection pool exhaustion, cascading timeouts | no upstream timeout; slow LLM held server work | `AbortController` timeout + concurrency cap + 429 | tail recovered, no cascading failures |

All five were found by reading `pagebuilder_http_request_duration_ms` by route,
then drilling into a slow request via its `x-trace-id`.

---

## System under test

- Next.js 16 (Node runtime), Prisma + SQLite (`dev.db`), single process.
- Block trees stored as JSON in `Page.content` (see
  [ADR 0002](./adr/0002-recursive-json-block-tree.md),
  [ADR 0006](./adr/0006-prisma-sqlite-json-columns.md)).
- Load generated with [k6](https://grafana.com/docs/k6/); the autosave profile is
  [`scripts/load/k6-autosave.js`](../scripts/load/k6-autosave.js).

### Method

1. Establish a baseline at low concurrency (20 VUs) per critical path.
2. Ramp to 100 VUs; watch `http_req_duration` p95/p99 and `http_req_failed`.
3. Cross-reference the app's own metrics (`/api/internal/metrics`) and structured
   logs to localize the cost (handler vs. DB vs. upstream).
4. Pick the worst offender, fix, re-run, compare.

---

## Incident 1 — Dashboard N+1 on page thumbnails

**Symptom.** The dashboard (`GET /api/pages` + thumbnail hydration) held p95
≈ 1.8s at only 50 VUs while CPU stayed low — classic I/O wait.

**Diagnosis.** `pagebuilder_db_query_duration_ms{op="page.findMany"}` was fast,
but the *number* of DB spans per request scaled with the page count. Tracing one
request by `x-trace-id` showed one query for the list plus one query **per page**
to resolve its thumbnail — an N+1.

**Root cause.** Thumbnail lookup happened in a `.map()` after the list query
instead of being joined/included.

**Fix.**
- Fetch thumbnails in a single query (`include`/grouped `findMany` on
  `PageThumbnail`) and stitch in memory.
- Confirmed `@@index([workspaceId])` on `Page` was actually used for the
  workspace-scoped list.

**Result.** 51 queries → 2 queries for a 50-page workspace; p95 **1.8s → 120ms**.

**Lesson.** Per-request *query count* is a first-class signal. Counting DB spans
per trace surfaces N+1s that average latency hides.

---

## Incident 2 — `SQLITE_BUSY` under concurrent autosave

**Symptom.** At 100 VUs the autosave test produced a **4.1%** error rate;
`pagebuilder_errors_total{route="/api/pages/:id"}` climbed and logs showed
`SqliteError: database is locked`.

**Diagnosis.** SQLite's default rollback journal allows a single writer and no
reader/writer concurrency. Autosave is write-heavy, so writers serialized and
timed out.

**Root cause.** Default journal mode + no busy timeout, plus write amplification
from Incident 3.

**Fix.**
```sql
PRAGMA journal_mode = WAL;     -- readers don't block the writer
PRAGMA busy_timeout = 5000;    -- wait instead of failing instantly
PRAGMA synchronous = NORMAL;   -- safe with WAL, far fewer fsyncs
```
Applied on connection init. (This is a SQLite stopgap; the real horizontal fix is
Postgres — see [ADR 0006](./adr/0006-prisma-sqlite-json-columns.md).)

**Result.** Error rate **4.1% → 0%** at 100 VUs; write p95 halved from reduced
fsync pressure.

**Lesson.** A dev-default datastore needs production pragmas before you trust load
numbers. Know your storage engine's concurrency model.

---

## Incident 3 — Autosave write amplification

**Symptom.** Autosave p95 grew with document size; a 40-block page sent ~38KB on
*every* debounce tick, even when one word changed.

**Diagnosis.** The editor serialized and PUT the **entire** block tree each time.
`http_request_duration_ms{route="/api/pages/:id"}` correlated with payload size;
most server time was JSON parse + a full-column write.

**Root cause.** Autosave persisted the whole `Page.content` JSON unconditionally —
simple, but O(document) per edit.

**Fix.**
- Debounce already existed; added a **dirty check** so identical content is never
  re-sent.
- Enabled **gzip** on the request (and response) — block JSON compresses ~9×.
- Added a server-side **payload size guard** (reject absurd trees early) and moved
  `JSON.stringify` of content off the critical validation path.
- Tradeoff considered & rejected for now: JSON-patch deltas (more complex,
  conflict handling) — deferred until multi-user editing lands.

**Result.** Median write payload **38KB → ~3KB**; autosave p95 at 100 VUs dropped
~45%. Fewer bytes also relieved Incident 2's writer contention.

**Lesson.** "Save the whole doc" is fine until it isn't. Measure payload growth
against document size, not just request count.

---

## Incident 4 — Big-page stylesheet regeneration stalls the event loop

**Symptom.** Rendering/exporting a large page (200+ blocks) showed TTFB ≈ 640ms
and brief event-loop stalls; concurrent requests queued behind it.

**Diagnosis.** A flame profile (Node `--prof`, triggered while the load test hit
the public route) put most time in the responsive style resolver
([`lib/blocks/styles.ts`](../lib/blocks/styles.ts)), which rebuilt the **entire**
scoped stylesheet synchronously on each render — O(blocks) string building on the
request thread.

**Root cause.** No memoization: identical block styles were recompiled every
render, and the work was synchronous CPU on the event loop.

**Fix.**
- Memoize per-block CSS keyed by `blockId + hash(styles)`; only changed blocks
  recompile.
- Reuse the cache across the editor preview and the public/export paths (same
  resolver, per [ADR 0009](./adr/0009-responsive-scoped-styles.md)).

**Result.** TTFB on a 200-block page **640ms → 180ms**; event-loop stalls gone;
public-route throughput up ~3× at the knee.

**Lesson.** Synchronous CPU on the request thread is a throughput killer in Node.
Profile *under load*, not in isolation.

---

## Incident 5 — AI generation exhausts capacity on slow upstreams

**Symptom.** When the LLM provider was slow (p99 > 20s), `POST /api/ai` requests
piled up; unrelated routes' latency rose — head-of-line blocking.

**Diagnosis.** `ai.generate` logs showed `upstream_ms` in the tens of seconds.
The `fetch` to Anthropic/OpenAI had **no timeout**, so each slow generation held a
worker until the client gave up.

**Root cause.** Unbounded upstream calls + no concurrency limit on an expensive,
externally-dependent endpoint.

**Fix.**
- `AbortController` timeout (e.g. 30s) on the provider `fetch`; return a clean
  `504` on timeout.
- A small **in-process concurrency semaphore** for AI calls; over the cap returns
  `429 Too Many Requests` with `Retry-After` instead of degrading the whole app.
- Surfaced `upstream_ms` as a metric so provider degradation is alertable.

**Result.** Slow-provider scenario no longer cascaded; non-AI route p95 stayed
flat while AI shed load gracefully.

**Lesson.** Every external call needs a timeout and a bulkhead. Isolate expensive,
third-party-dependent work so it can't sink the rest of the system.

---

## What load testing changed about the design

- **WAL + busy_timeout** became part of DB init, not an afterthought.
- **Autosave** is now diff-aware and compressed.
- **Style generation** is memoized and shared across render paths.
- **External calls** are bounded (timeout + bulkhead) by default.
- **Per-trace DB-span counts** are now a thing we watch — N+1s can't hide.

## Known limits / next load milestones

- SQLite single-writer remains the ceiling for write throughput; the Postgres
  migration ([ADR 0006](./adr/0006-prisma-sqlite-json-columns.md)) is the next
  scaling step and unblocks multiple app instances.
- Thumbnails are generated by headless Chromium in-process; under heavy page
  churn this should move to an external job runner (see
  [deployment topology](./architecture.md#8-deployment-topology-target)).
- No multi-instance test yet — current numbers are single-process. Horizontal
  scaling needs externalized sessions/uploads first.

## How to reproduce

```bash
# 1. Start the app
npm run dev

# 2. Create a page, grab its id and your pc_session cookie (DevTools → Application)

# 3. Run the autosave load profile
BASE_URL=http://localhost:3000 PAGE_ID=<id> PC_SESSION=<cookie> \
  k6 run scripts/load/k6-autosave.js

# 4. Watch the app's own metrics while it runs
watch -n1 'curl -s localhost:3000/api/internal/metrics | grep duration_ms_count'
```

Correlate any slow/failed request via its `x-trace-id` response header against the
structured logs (`trace_id`).
