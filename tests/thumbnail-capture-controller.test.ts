import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerThumbnailCapturer,
  requestThumbnailCapture,
  resetCaptureController,
} from "@/lib/thumbnails/capture-controller";

beforeEach(() => resetCaptureController());
afterEach(() => vi.useRealTimers());

describe("requestThumbnailCapture", () => {
  it("resolves null when no capturer is registered", async () => {
    expect(await requestThumbnailCapture({ force: true })).toBeNull();
  });

  it("is single-flight: overlapping calls share one capture", async () => {
    let resolveFn!: (r: { url: string; version: number }) => void;
    const capturer = vi.fn(
      () => new Promise<{ url: string; version: number }>((res) => (resolveFn = res)),
    );
    registerThumbnailCapturer(capturer);

    const a = requestThumbnailCapture({ force: true });
    const b = requestThumbnailCapture({ force: true });
    resolveFn({ url: "/u.png", version: 1 });

    expect(await a).toEqual({ url: "/u.png", version: 1 });
    expect(await b).toEqual({ url: "/u.png", version: 1 });
    expect(capturer).toHaveBeenCalledTimes(1);
  });

  it("throttles rapid non-forced calls, then allows again after the window", async () => {
    vi.useFakeTimers();
    const capturer = vi.fn(async () => ({ url: "/u.png", version: 1 }));
    registerThumbnailCapturer(capturer);

    expect(await requestThumbnailCapture()).toEqual({ url: "/u.png", version: 1 });
    expect(await requestThumbnailCapture()).toBeNull(); // throttled
    vi.advanceTimersByTime(5000);
    expect(await requestThumbnailCapture()).toEqual({ url: "/u.png", version: 1 });
    expect(capturer).toHaveBeenCalledTimes(2);
  });

  it("swallows capturer errors and resolves null", async () => {
    registerThumbnailCapturer(async () => {
      throw new Error("boom");
    });
    expect(await requestThumbnailCapture({ force: true })).toBeNull();
  });
});
