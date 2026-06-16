// ---------------------------------------------------------------------------
// Structured logger.
//
// Emits one JSON object per line in production (machine-parseable, ready for a
// log shipper) and a compact coloured line in development. Every record is
// auto-enriched with the active trace/span id (see trace.ts) so logs and traces
// correlate without the caller passing ids around.
// ---------------------------------------------------------------------------

import { traceFields } from "./trace";

export type Level = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, unknown>;

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProd = process.env.NODE_ENV === "production";
const configured = (process.env.LOG_LEVEL as Level) || (isProd ? "info" : "debug");
const MIN_RANK = LEVEL_RANK[configured] ?? LEVEL_RANK.info;

const COLOR: Record<Level, string> = {
  debug: "\x1b[90m", // grey
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return { error: { name: err.name, message: err.message, stack: err.stack } };
  }
  return { error: err };
}

function write(level: Level, msg: string, fields: Fields): void {
  if (LEVEL_RANK[level] < MIN_RANK) return;

  const record: Fields = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...traceFields(),
    ...fields,
  };

  if (isProd) {
    process.stdout.write(JSON.stringify(record) + "\n");
    return;
  }

  // Dev: readable single line with the structured tail appended as JSON.
  const { ts, level: _l, msg: _m, ...rest } = record;
  const tail = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
  const line = `${COLOR[level]}${String(ts).slice(11, 23)} ${level.toUpperCase().padEnd(5)}${RESET} ${msg}${tail}`;
  // eslint-disable-next-line no-console
  console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** Return a logger that merges `bound` fields into every record. */
  child(bound: Fields): Logger;
}

function make(bound: Fields): Logger {
  const merged = (fields?: Fields) => (fields ? { ...bound, ...fields } : bound);
  return {
    debug: (msg, fields) => write("debug", msg, merged(fields)),
    info: (msg, fields) => write("info", msg, merged(fields)),
    warn: (msg, fields) => write("warn", msg, merged(fields)),
    error: (msg, fields) => write("error", msg, merged(fields)),
    child: (childBound) => make({ ...bound, ...childBound }),
  };
}

export const logger: Logger = make({});

/** Helper for logging caught errors with a normalized `error` field. */
export function logError(log: Logger, msg: string, err: unknown, fields: Fields = {}): void {
  log.error(msg, { ...fields, ...serializeError(err) });
}
