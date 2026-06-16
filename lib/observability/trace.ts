// ---------------------------------------------------------------------------
// Lightweight tracing built on AsyncLocalStorage.
//
// Produces W3C-style trace/span ids and propagates the active span across
// awaits, so any log line or DB call within a request can be correlated by
// trace_id. Spans are emitted as structured logs on completion and timed into
// a histogram. The shape is intentionally OTLP-compatible: swapping in the
// OpenTelemetry SDK later means replacing this file, not its call sites.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

export type Span = {
  traceId: string;
  spanId: string;
  parentId?: string;
  name: string;
  startedAt: number;
  attributes: Record<string, unknown>;
};

const storage = new AsyncLocalStorage<Span>();

function hex(bytes: number): string {
  let out = "";
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return out;
}

/** 16-byte trace id / 8-byte span id, hex-encoded (W3C trace-context sizes). */
export const newTraceId = (): string => hex(16);
export const newSpanId = (): string => hex(8);

/** The currently active span, if any. */
export function currentSpan(): Span | undefined {
  return storage.getStore();
}

/** Trace correlation fields to merge into a log record. */
export function traceFields(): { trace_id?: string; span_id?: string } {
  const s = storage.getStore();
  return s ? { trace_id: s.traceId, span_id: s.spanId } : {};
}

type SpanEndHook = (span: Span, durationMs: number, error: boolean) => void;
let onSpanEnd: SpanEndHook | undefined;

/** Register a hook invoked whenever a span finishes (used to emit logs/metrics
 *  without creating an import cycle between trace/logger/metrics). */
export function setSpanEndHook(hook: SpanEndHook): void {
  onSpanEnd = hook;
}

/**
 * Run `fn` inside a new span. Inherits the parent trace id if one is active,
 * otherwise starts a new trace. Records duration and error state on completion.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes: Record<string, unknown> = {},
): Promise<T> {
  const parent = storage.getStore();
  const span: Span = {
    traceId: parent?.traceId ?? newTraceId(),
    spanId: newSpanId(),
    parentId: parent?.spanId,
    name,
    startedAt: performance.now(),
    attributes: { ...attributes },
  };

  let errored = false;
  return storage.run(span, async () => {
    try {
      return await fn(span);
    } catch (err) {
      errored = true;
      span.attributes.error = true;
      throw err;
    } finally {
      const durationMs = performance.now() - span.startedAt;
      onSpanEnd?.(span, durationMs, errored);
    }
  });
}
