import { renderMetrics } from "@/lib/observability";

export const dynamic = "force-dynamic";

// GET /api/internal/metrics — Prometheus scrape endpoint.
//
// Token-gated because this path is reachable publicly (proxy.ts does not gate
// /api). Set METRICS_TOKEN and scrape with:
//   Authorization: Bearer <token>   (or ?token=<token>)
// If METRICS_TOKEN is unset, the endpoint is open in development only.
export async function GET(req: Request) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const url = new URL(req.url);
    const provided =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      url.searchParams.get("token") ||
      "";
    if (provided !== token) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new Response("Metrics disabled: set METRICS_TOKEN", { status: 404 });
  }

  return new Response(renderMetrics(), {
    status: 200,
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
