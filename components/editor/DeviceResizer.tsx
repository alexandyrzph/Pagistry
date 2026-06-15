"use client";

import { cn } from "@/lib/utils";

// A draggable "pipe" on a side of the device frame for resizing the preview width.
// Idle: a faint full-height rail. Hover: thickens + turns indigo with a grip.
// Resizing: solid indigo + a live width badge. Positioned just outside the device
// edge (absolute within the device's sizing box, which is `relative`).
export function DeviceResizer({
  side,
  width,
  resizing,
  onPointerDown,
}: {
  side: "left" | "right";
  width: number;
  resizing: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to resize the preview"
      aria-label="Resize preview width"
      className={cn(
        "group absolute top-0 z-20 flex h-full w-5 cursor-ew-resize touch-none select-none items-center justify-center",
        side === "left" ? "-left-5" : "-right-5"
      )}
    >
      {/* the pipe */}
      <span
        className={cn(
          "relative flex h-[86%] w-1 items-center justify-center rounded-full shadow-sm transition-all duration-200 ease-out",
          resizing
            ? "w-[5px] bg-indigo-500"
            : "bg-zinc-300/90 group-hover:h-[92%] group-hover:w-[5px] group-hover:bg-indigo-400"
        )}
      >
        {/* center grip dots, revealed on hover/resize */}
        <span
          className={cn(
            "flex flex-col gap-0.5 opacity-0 transition-opacity duration-200",
            resizing ? "opacity-100" : "group-hover:opacity-100"
          )}
        >
          <span className="h-0.5 w-0.5 rounded-full bg-white/90" />
          <span className="h-0.5 w-0.5 rounded-full bg-white/90" />
          <span className="h-0.5 w-0.5 rounded-full bg-white/90" />
        </span>
      </span>

      {/* live width badge while dragging */}
      {resizing && (
        <span
          className={cn(
            "pointer-events-none absolute top-3 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg",
            side === "left" ? "left-1" : "right-1"
          )}
        >
          {Math.round(width)}px
        </span>
      )}
    </div>
  );
}
