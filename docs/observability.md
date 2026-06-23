# Observability

> "Code isn't done until it can be monitored in production."

Pagistry emits the three pillars — **logs, metrics, and traces** — from a small,
dependency-free toolkit in [`lib/observability/`](../lib/observability). The
shapes deliberately match industry standards (JSON logs, Prometheus exposition,
W3C trace ids / OTLP-style spans) so each pillar can be pointed at a real backend
(Loki, Prometheus/Grafana, Tempo/Jaeger) without touching call sites. See the
[observability pipeline diagram](./architecture.md#7-observability-pipeline).

---

## TL;DR

| Pillar  | Where it's produced                              | How to read it                                |
| ------- | ------------------------------------------------ | --------------------------------------------- |
| Logs    | `logger` (structured JSON to stdout)             | `npm run dev` console, or ship stdout to Loki |
| Metrics | `metrics` registry (counters/histograms)         | `GET /api/internal/metrics` (Prometheus text) |
| Traces  | `withSpan` / `instrumentApi` (AsyncLocalStorage) | `trace_id` on every log + `x-trace-id` header |
| Health  | `GET /api/internal/health`                       | LB/uptime probe (200 ok / 503 degraded)       |

---

## 1. Structured logging

[`lib/observability/logger.ts`](../lib/observability/logger.ts)

- One JSON object per line in production; a compact coloured line in dev.
- Every record is auto-enriched with `trace_id` / `span_id` from the active span,
  so logs join to traces for free.
- Levels: `debug | info | warn | error`, gated by `LOG_LEVEL` (default `info` in
  prod, `debug` in dev).
- `logger.child({ ... })` binds context (e.g. `workspace_id`) to a sub-logger.

```ts
import { logger, logError } from "@/lib/observability";

logger.info("page.published", { page_id, workspace_id });

try {
  await risky();
} catch (err) {
  logError(logger, "thumbnail.failed", err, { page_id });
}
```

Example production line:

```json
{
  "ts": "2026-06-16T15:42:01.123Z",
  "level": "info",
  "msg": "request",
  "trace_id": "4f1c…",
  "span_id": "a93b…",
  "method": "PUT",
  "route": "/api/pages/:id",
  "status": 200,
  "duration_ms": 38.4
}
```

---

## 2. Metrics

[`lib/observability/metrics.ts`](../lib/observability/metrics.ts) — a tiny
Prometheus-compatible registry (counters + histograms with labels), cached on
`globalThis` so values survive dev hot reloads.

### Exposed series

| Metric                                 | Type      | Labels                | Meaning                           |
| -------------------------------------- | --------- | --------------------- | --------------------------------- |
| `pagebuilder_http_requests_total`      | counter   | `method,route,status` | Requests handled                  |
| `pagebuilder_http_request_duration_ms` | histogram | `method,route`        | Handler latency                   |
| `pagebuilder_authz_total`              | counter   | `result,role,status`  | Allow/deny decisions at the guard |
| `pagebuilder_db_query_duration_ms`     | histogram | `op`                  | Instrumented DB op latency        |
| `pagebuilder_errors_total`             | counter   | `route,method`        | Unhandled throws in handlers      |

`authz_total` is recorded **globally** in `runGuarded` (so every guarded route
contributes with zero extra code); the HTTP and DB series come from the
`instrumentApi` / `timeDb` wrappers.

### Scraping

```bash
# dev (open when METRICS_TOKEN is unset)
curl localhost:3000/api/internal/metrics

# prod (token required)
curl -H "Authorization: Bearer $METRICS_TOKEN" https://app.example.com/api/internal/metrics
```

Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: pagistry
    metrics_path: /api/internal/metrics
    authorization:
      credentials: ${METRICS_TOKEN}
    static_configs:
      - targets: ["app.example.com"]
```

### Useful PromQL

```promql
# p95 latency per route
histogram_quantile(0.95, sum(rate(pagebuilder_http_request_duration_ms_bucket[5m])) by (le, route))

# error rate
sum(rate(pagebuilder_errors_total[5m])) / sum(rate(pagebuilder_http_requests_total[5m]))

# authz denial rate
sum(rate(pagebuilder_authz_total{result="denied"}[5m]))
```

---

## 3. Tracing

[`lib/observability/trace.ts`](../lib/observability/trace.ts) uses Node's
`AsyncLocalStorage` to keep a span active across `await` boundaries and propagate
a `trace_id` through the whole request.

- `instrumentApi(route, req, fn)` opens the root server span per request, times
  it, records metrics, and sets `x-trace-id` on the response.
- `timeDb(op, fn)` opens a child span for a DB call and feeds the DB histogram.
- `withSpan(name, fn, attrs)` is the general primitive for any sub-operation.
- Nesting is automatic: child spans inherit the parent's `trace_id`.

```ts
import { instrumentApi, timeDb } from "@/lib/observability";

export async function GET(req: Request) {
  return instrumentApi("/api/pages", req, () =>
    withWorkspace(async (ws) => {
      const pages = await timeDb("page.findMany", () =>
        prisma.page.findMany({ where: { workspaceId: ws.workspace.id } }),
      );
      return json(pages);
    }),
  );
}
```

Because spans are emitted as logs and carry OTLP-shaped fields, swapping in the
OpenTelemetry SDK is a matter of replacing `trace.ts` + initializing the SDK in
[`instrumentation.ts`](../instrumentation.ts) — call sites stay the same.

### Debugging with a trace id

Every response carries `x-trace-id`. To investigate a slow/failed request, grab
that header and filter logs:

```bash
grep '"trace_id":"4f1c…"' app.log | jq .
```

---

## 4. Health checks

`GET /api/internal/health` returns `200` when the process is up and the database
answers `SELECT 1`, `503` otherwise — suitable for a load-balancer readiness
probe or an uptime monitor.

```json
{
  "status": "ok",
  "uptime_s": 1287,
  "checks": { "database": { "ok": true, "latency_ms": 1.2 } },
  "timestamp": "…"
}
```

---

## Configuration

| Env var         | Default                 | Purpose                                                                  |
| --------------- | ----------------------- | ------------------------------------------------------------------------ |
| `LOG_LEVEL`     | `info` (prod) / `debug` | Minimum log level                                                        |
| `METRICS_TOKEN` | _(unset)_               | Bearer token for `/api/internal/metrics`; if unset, metrics are dev-only |
| `NODE_ENV`      | —                       | `production` switches logs to JSON, hides dev-open metrics               |

---

## Rollout status & next steps

- ✅ Toolkit (logger, metrics, traces), `instrumentation.ts`, metrics + health
  endpoints, global authz metrics.
- ✅ Reference instrumentation on the hot paths: `/api/pages`, `/api/pages/:id`,
  `/api/ai`.
- ⏭️ Apply `instrumentApi` to the remaining ~29 route handlers (mechanical — wrap
  the existing body).
- ⏭️ Export traces via OTLP from `instrumentation.ts` for distributed tracing.
- ⏭️ Add RUM/client metrics for editor interactions (drag latency, autosave round
  trips) and Core Web Vitals on published pages.
- ⏭️ Ship a Grafana dashboard JSON + alert rules (latency SLO, error budget).
