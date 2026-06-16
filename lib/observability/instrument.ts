// ---------------------------------------------------------------------------
// Glue layer: connects spans → logs + metrics, and exposes the wrappers route
// handlers and domain code use to become observable.
// ---------------------------------------------------------------------------

import { logger, logError } from "./logger";
import {
  httpRequestsTotal,
  httpRequestDurationMs,
  errorsTotal,
  dbQueryDurationMs,
} from "./metrics";
import { withSpan, setSpanEndHook, currentSpan, type Span } from "./trace";

// Every finished span emits a debug log + feeds the latency histogram. Done via
// a hook to keep trace.ts free of imports from logger/metrics.
let hookInstalled = false;
function ensureHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  setSpanEndHook((span: Span, durationMs: number, error: boolean) => {
    logger.debug("span.end", {
      span: span.name,
      duration_ms: Math.round(durationMs * 100) / 100,
      error,
      ...span.attributes,
    });
  });
}
ensureHook();

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Wrap an API route handler body. Creates a request span, times it, records
 * http_* metrics, logs one structured request line, attaches `x-trace-id` to
 * the response, and converts unhandled throws into a 500 (also counted).
 *
 *   export async function GET(req: Request) {
 *     return instrumentApi("/api/pages", req, () => withWorkspace(...));
 *   }
 */
export async function instrumentApi(
  route: string,
  req: Request,
  fn: () => Promise<Response> | Response,
): Promise<Response> {
  const method = req.method ?? "GET";
  ensureHook();

  return withSpan(
    `${method} ${route}`,
    async (span) => {
      const start = performance.now();
      let status = 200;
      try {
        const res = await fn();
        status = res.status;
        try {
          res.headers.set("x-trace-id", span.traceId);
        } catch {
          // Some Response instances have immutable headers; ignore.
        }
        return res;
      } catch (err) {
        status = 500;
        errorsTotal.inc({ route, method });
        logError(logger, "request.error", err, { route, method });
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json", "x-trace-id": span.traceId },
        });
      } finally {
        const duration = performance.now() - start;
        const labels = { method, route, status };
        httpRequestsTotal.inc(labels);
        httpRequestDurationMs.observe(duration, { method, route });
        const log = status >= 500 ? logger.error : status >= 400 ? logger.warn : logger.info;
        log.call(logger, "request", {
          method,
          route,
          status,
          duration_ms: round(duration),
        });
        span.attributes.status = status;
        span.attributes.duration_ms = round(duration);
      }
    },
    { route, method, "span.kind": "server" },
  );
}

/**
 * Time a database (or other I/O) operation into a child span + the db histogram.
 * Use for the hot queries you care about; not every call needs wrapping.
 *
 *   const pages = await timeDb("page.findMany", () => prisma.page.findMany(...));
 */
export async function timeDb<T>(op: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await withSpan(`db ${op}`, fn, { "db.operation": op, "span.kind": "client" });
  } finally {
    dbQueryDurationMs.observe(performance.now() - start, { op });
  }
}

export { currentSpan };
