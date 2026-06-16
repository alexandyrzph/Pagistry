// Next.js calls register() once when the server boots. We use it to announce
// startup with structured logging and to make sure unhandled rejections /
// exceptions are captured rather than dying silently. This is also the hook
// where an OpenTelemetry SDK would be initialized in production.
export async function register() {
  // Only run in the Node.js server runtime (not edge / browser bundles).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("@/lib/observability");

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
