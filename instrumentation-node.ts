// Node.js-only server instrumentation. Kept in a separate module (not in
// instrumentation.ts) and loaded via a dynamic import from register() so the
// Node APIs below (process.on / process.pid / process.version) are NEVER part
// of the Edge runtime bundle. Next statically scans instrumentation.ts for both
// runtimes, so referencing these APIs there — even behind a NEXT_RUNTIME guard —
// trips the "Node.js API ... not supported in the Edge Runtime" error.
import { logger } from "@/lib/observability";

export function registerNode() {
  logger.info("server.start", {
    node: process.version,
    env: process.env.NODE_ENV,
    pid: process.pid,
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandledRejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException", { message: err.message, stack: err.stack });
  });
}
