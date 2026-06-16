// Public surface of the observability toolkit. Import from "@/lib/observability".
export { logger, logError, type Logger, type Level, type Fields } from "./logger";
export {
  withSpan,
  currentSpan,
  traceFields,
  newTraceId,
  newSpanId,
  type Span,
} from "./trace";
export {
  registry,
  renderMetrics,
  httpRequestsTotal,
  httpRequestDurationMs,
  authzTotal,
  dbQueryDurationMs,
  errorsTotal,
  type Labels,
} from "./metrics";
export { instrumentApi, timeDb } from "./instrument";
