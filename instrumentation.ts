// Next.js calls register() once when the server boots, in BOTH the Node.js and
// Edge runtimes. The Node-only startup logging + process-level error capture
// lives in ./instrumentation-node and is loaded via a dynamic import guarded by
// NEXT_RUNTIME, so its Node APIs are excluded from the Edge bundle entirely.
// (See node_modules/next/dist/docs/.../instrumentation.md — "Specifying the runtime".)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    registerNode();
  }
}
