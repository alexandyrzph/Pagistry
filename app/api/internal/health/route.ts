import { prisma } from "@/lib/prisma";
import { logError, logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

// GET /api/internal/health — liveness + readiness probe.
// Returns 200 when the process is up and the database answers, 503 otherwise.
export async function GET() {
  let dbOk = false;
  const t0 = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    logError(logger, "health.db_check_failed", err);
  }
  const dbLatencyMs = Math.round((performance.now() - t0) * 100) / 100;

  const body = {
    status: dbOk ? "ok" : "degraded",
    uptime_s: Math.round((Date.now() - startedAt) / 1000),
    checks: { database: { ok: dbOk, latency_ms: dbLatencyMs } },
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: dbOk ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
