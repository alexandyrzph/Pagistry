"use client";

import { useState } from "react";
import { Popover } from "./Popover";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBreakpoints } from "@/store/breakpoints";
import { useCanvasZoom, ZOOM_MAX, ZOOM_MIN } from "@/store/canvas-zoom";

const PRESETS = [0.5, 0.75, 1, 1.5, 2];

const btn =
  "flex items-center justify-center rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30";

export function ZoomControl() {
  const zoom = useCanvasZoom((s) => s.zoom);
  const setZoom = useCanvasZoom((s) => s.setZoom);
  const zoomIn = useCanvasZoom((s) => s.zoomIn);
  const zoomOut = useCanvasZoom((s) => s.zoomOut);
  const viewportWidth = useCanvasZoom((s) => s.viewportWidth);
  const { active } = useBreakpoints();
  const [open, setOpen] = useState(false);

  const fit = () => {
    if (viewportWidth && active.width) setZoom(viewportWidth / active.width);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-0.5 rounded-xl bg-zinc-100 p-1">
      <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN + 0.001} title="Zoom out (⌘−)" aria-label="Zoom out" className={btn}>
        <Minus size={15} />
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Zoom presets"
        aria-label="Zoom level"
        className={cn(
          "min-w-[46px] rounded-lg px-1.5 py-1 text-xs font-semibold tabular-nums transition-colors hover:bg-white",
          open ? "bg-white text-indigo-600 shadow-xs ring-1 ring-zinc-200" : "text-zinc-600"
        )}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX - 0.001} title="Zoom in (⌘+)" aria-label="Zoom in" className={btn}>
        <Plus size={15} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} className="left-1/2 top-11 w-40 -translate-x-1/2 rounded-xl p-1">
        <button
          onClick={fit}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          Fit to width
        </button>
        <div className="my-1 h-px bg-zinc-100" />
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setZoom(p);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            {Math.round(p * 100)}%
            {Math.abs(zoom - p) < 0.001 && <Check size={14} className="text-indigo-600" />}
          </button>
        ))}
      </Popover>
    </div>
  );
}
