"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Viewport } from "@/lib/types";

/**
 * Wraps the canvas content in a realistic device chrome:
 *  - desktop → a browser window (traffic lights + URL bar)
 *  - tablet / mobile → a hardware bezel with notch + home indicator
 * Content scrolls inside the frame, like a real device.
 */
export function DeviceFrame({
  viewport,
  slug,
  children,
}: {
  viewport: Viewport;
  slug: string;
  children: React.ReactNode;
  onContentClick?: () => void;
}) {
  if (viewport === "desktop") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-zinc-200">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3.5">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </span>
          <div className="mx-auto flex w-1/2 max-w-sm items-center justify-center gap-1.5 truncate rounded-md bg-white px-3 py-1 text-xs text-zinc-400 ring-1 ring-zinc-200">
            <Lock size={10} className="shrink-0" />
            <span className="truncate">pagecraft.app/p/{slug || "page"}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  const mobile = viewport === "mobile";
  return (
    <div
      className={cn(
        "relative mx-auto h-full w-full overflow-hidden bg-zinc-900 shadow-2xl ring-1 ring-black/30",
        mobile ? "rounded-[44px] p-3" : "rounded-[34px] p-3.5"
      )}
    >
      <div
        className={cn(
          "relative h-full overflow-hidden bg-white",
          mobile ? "rounded-[32px]" : "rounded-[22px]"
        )}
      >
        <div className="h-full overflow-y-auto">{children}</div>

        {/* notch / camera */}
        {mobile ? (
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex h-6 w-32 -translate-x-1/2 items-center justify-center gap-2 rounded-b-2xl bg-zinc-900">
            <span className="h-1 w-9 rounded-full bg-zinc-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
          </div>
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-1.5 z-20 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-zinc-300" />
        )}

        {/* home indicator */}
        <div
          className={cn(
            "pointer-events-none absolute bottom-1.5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-zinc-400/80",
            mobile ? "h-1 w-28" : "h-1 w-24"
          )}
        />
      </div>
    </div>
  );
}
