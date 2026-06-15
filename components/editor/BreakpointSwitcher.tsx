"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Plus, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Viewport } from "@/lib/types";
import { useBreakpoints, type Breakpoint } from "@/store/breakpoints";

const BASE_ICON: Record<Viewport, React.ReactNode> = {
  desktop: <Monitor size={16} />,
  tablet: <Tablet size={16} />,
  mobile: <Smartphone size={16} />,
};

const PRESETS = [
  { label: "Full HD", width: 1920 },
  { label: "Laptop", width: 1440 },
  { label: "Small laptop", width: 1024 },
  { label: "iPad", width: 768 },
  { label: "iPhone Pro Max", width: 430 },
  { label: "iPhone SE", width: 375 },
  { label: "Small phone", width: 320 },
];

const baseFor = (w: number): Viewport => (w >= 1024 ? "desktop" : w >= 640 ? "tablet" : "mobile");

export function BreakpointSwitcher() {
  const { list, custom, active, setActive, addBreakpoint, removeBreakpoint } = useBreakpoints();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState("");
  const [label, setLabel] = useState("");

  const addCustom = (w: number, l?: string) => {
    if (!w || w < 240) return;
    addBreakpoint({ width: w, label: l, base: baseFor(w) });
    setWidth("");
    setLabel("");
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
        {list.map((bp) => (
          <BpButton key={bp.id} bp={bp} active={bp.id === active.id} onClick={() => setActive(bp.id)} />
        ))}

        <button
          onClick={() => setOpen((o) => !o)}
          title="Add custom breakpoint"
          className={cn(
            "flex items-center justify-center rounded-lg p-1.5 transition-colors",
            open ? "bg-white text-indigo-600 shadow-xs ring-1 ring-zinc-200" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* live width readout */}
      <span className="hidden w-14 text-xs font-medium tabular-nums text-zinc-400 lg:inline">
        {active.width}px
      </span>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 460, damping: 32 }}
              className="absolute left-1/2 top-11 z-50 w-72 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl ring-1 ring-black/5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold tracking-tight text-zinc-800">Custom breakpoints</span>
                <button onClick={() => setOpen(false)} className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>

              {/* presets */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.width}
                    onClick={() => addCustom(p.width, p.label)}
                    title={`${p.label} — ${p.width}px`}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    {p.width}
                  </button>
                ))}
              </div>

              {/* custom width + label */}
              <div className="flex items-end gap-1.5">
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">Width (px)</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustom(Number(width), label)}
                    placeholder="1280"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">Label</span>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustom(Number(width), label)}
                    placeholder="optional"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <button
                  onClick={() => addCustom(Number(width), label)}
                  disabled={!width || Number(width) < 240}
                  className="flex h-[34px] items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              {/* existing custom list */}
              {custom.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-zinc-100 pt-2">
                  {custom.map((bp) => (
                    <div key={bp.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-50">
                      <span className="text-zinc-400">{BASE_ICON[bp.base]}</span>
                      <span className="flex-1 truncate text-xs font-medium text-zinc-700">{bp.label}</span>
                      <span className="text-[11px] tabular-nums text-zinc-400">{bp.width}px</span>
                      <button
                        onClick={() => removeBreakpoint(bp.id)}
                        title="Remove"
                        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BpButton({ bp, active, onClick }: { bp: Breakpoint; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${bp.label} · ${bp.width}px`}
      className={cn(
        "relative flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-semibold transition-colors",
        active ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
      )}
    >
      {active && (
        <motion.span
          layoutId="bp-pill"
          className="absolute inset-0 rounded-lg bg-white shadow-xs ring-1 ring-zinc-200"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">
        {BASE_ICON[bp.base]}
        {bp.custom && <span className="tabular-nums">{bp.width}</span>}
      </span>
    </button>
  );
}
