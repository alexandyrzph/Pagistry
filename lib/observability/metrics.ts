// ---------------------------------------------------------------------------
// Tiny, dependency-free metrics registry with a Prometheus text exposition.
//
// Why hand-rolled: the app runs in a single Node process and we want metrics
// without pulling in a heavy client. The shapes (counter / histogram, labelled
// series, /metrics scrape) match Prometheus so this can be swapped for
// prom-client or an OTLP exporter later without changing call sites.
//
// The registry is cached on globalThis so values survive Next.js dev hot
// reloads (same pattern as lib/prisma.ts).
// ---------------------------------------------------------------------------

export type Labels = Record<string, string | number>;

// Latency buckets in milliseconds — tuned for HTTP handlers and DB calls.
export const DEFAULT_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

function renderLabels(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  const inner = keys
    .map((k) => `${k}="${String(labels[k]).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `{${inner}}`;
}

class Counter {
  readonly name: string;
  readonly help: string;
  private series = new Map<string, { labels: Labels; value: number }>();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: Labels = {}, by = 1): void {
    const key = labelKey(labels);
    const cur = this.series.get(key);
    if (cur) cur.value += by;
    else this.series.set(key, { labels, value: by });
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.series.values()) {
      lines.push(`${this.name}${renderLabels(labels)} ${value}`);
    }
    return lines.join("\n");
  }
}

class Histogram {
  readonly name: string;
  readonly help: string;
  readonly buckets: number[];
  private series = new Map<
    string,
    { labels: Labels; counts: number[]; sum: number; count: number }
  >();

  constructor(name: string, help: string, buckets: number[] = DEFAULT_BUCKETS_MS) {
    this.name = name;
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels: Labels = {}): void {
    const key = labelKey(labels);
    let s = this.series.get(key);
    if (!s) {
      s = { labels, counts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.series.set(key, s);
    }
    s.sum += value;
    s.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) s.counts[i] += 1;
    }
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const s of this.series.values()) {
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += s.counts[i];
        const le = { ...s.labels, le: this.buckets[i] };
        lines.push(`${this.name}_bucket${renderLabels(le)} ${cumulative}`);
      }
      const inf = { ...s.labels, le: "+Inf" };
      lines.push(`${this.name}_bucket${renderLabels(inf)} ${s.count}`);
      lines.push(`${this.name}_sum${renderLabels(s.labels)} ${s.sum}`);
      lines.push(`${this.name}_count${renderLabels(s.labels)} ${s.count}`);
    }
    return lines.join("\n");
  }
}

class Registry {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();

  counter(name: string, help = name): Counter {
    let c = this.counters.get(name);
    if (!c) {
      c = new Counter(name, help);
      this.counters.set(name, c);
    }
    return c;
  }

  histogram(name: string, help = name, buckets?: number[]): Histogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new Histogram(name, help, buckets);
      this.histograms.set(name, h);
    }
    return h;
  }

  render(): string {
    const parts: string[] = [];
    for (const c of this.counters.values()) parts.push(c.render());
    for (const h of this.histograms.values()) parts.push(h.render());
    return parts.join("\n\n") + "\n";
  }
}

const globalForMetrics = globalThis as unknown as { __pcRegistry?: Registry };
export const registry: Registry = globalForMetrics.__pcRegistry ?? new Registry();
if (!globalForMetrics.__pcRegistry) globalForMetrics.__pcRegistry = registry;

// --- Pre-declared application metrics (single source of metric names) --------

export const httpRequestsTotal = registry.counter(
  "pagebuilder_http_requests_total",
  "Total HTTP requests handled, labelled by method, route and status.",
);

export const httpRequestDurationMs = registry.histogram(
  "pagebuilder_http_request_duration_ms",
  "HTTP request handler duration in milliseconds.",
);

export const authzTotal = registry.counter(
  "pagebuilder_authz_total",
  "Authorization decisions at the API guard layer (allowed/denied).",
);

export const dbQueryDurationMs = registry.histogram(
  "pagebuilder_db_query_duration_ms",
  "Instrumented database operation duration in milliseconds.",
);

export const errorsTotal = registry.counter(
  "pagebuilder_errors_total",
  "Unhandled errors thrown inside instrumented handlers.",
);

/** Render the whole registry as Prometheus text exposition format. */
export function renderMetrics(): string {
  return registry.render();
}
