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
  now = Date.now(),
): Response | null {
  if (hit(`${name}:${clientIp(req)}`, limit, windowMs, now)) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(Math.ceil(windowMs / 1000)),
    },
  });
}
