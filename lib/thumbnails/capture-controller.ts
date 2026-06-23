export type ThumbnailResult = { url: string; version: number };
type Capturer = () => Promise<ThumbnailResult | null>;

const THROTTLE_MS = 4000;

let capturer: Capturer | null = null;
let inFlight: Promise<ThumbnailResult | null> | null = null;
let lastRun = 0;

export function registerThumbnailCapturer(fn: Capturer | null): void {
  capturer = fn;
  if (!fn) inFlight = null;
}

export function requestThumbnailCapture(
  opts: { force?: boolean } = {},
): Promise<ThumbnailResult | null> {
  if (!capturer) return Promise.resolve(null);
  if (inFlight) return inFlight;
  const now = Date.now();
  if (!opts.force && now - lastRun < THROTTLE_MS) return Promise.resolve(null);
  lastRun = now;
  const run = capturer;
  inFlight = run()
    .catch((e) => {
      console.error("[thumbnail] client capture failed", e);
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function resetCaptureController(): void {
  capturer = null;
  inFlight = null;
  lastRun = 0;
}
