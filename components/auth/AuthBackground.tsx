"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Image, LayoutGrid, Square, Type } from "lucide-react";

type Block = {
  id: string;
  /** position in % of viewport */
  top: string;
  left?: string;
  right?: string;
  /** parallax depth: higher = moves more with cursor */
  depth: number;
  rotate: number;
  width: number;
  delay: number;
  children: React.ReactNode;
};

// theme-aware placeholder bar tones (dark text on light, light text on dark)
const BAR_STRONG = "bg-zinc-900/20 dark:bg-white/25";
const BAR_MED = "bg-zinc-900/12 dark:bg-white/15";
const BAR_FAINT = "bg-zinc-900/[0.07] dark:bg-white/10";

const BLOCKS: Block[] = [
  {
    id: "hero",
    top: "14%",
    left: "8%",
    depth: 26,
    rotate: -6,
    width: 230,
    delay: 0,
    children: (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:bg-indigo-500/30 dark:text-indigo-200"><Type size={12} /></span>
          <div className={`h-2 w-20 rounded-full ${BAR_STRONG}`} />
        </div>
        <div className={`h-2 w-full rounded-full ${BAR_MED}`} />
        <div className={`h-2 w-3/4 rounded-full ${BAR_FAINT}`} />
        <div className="mt-3 h-7 w-24 rounded-lg bg-indigo-500/40" />
      </div>
    ),
  },
  {
    id: "image",
    top: "22%",
    right: "9%",
    depth: 44,
    rotate: 7,
    width: 200,
    delay: 0.15,
    children: (
      <div className="space-y-2.5">
        <div className="flex h-20 w-full items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/25 to-indigo-500/20 text-zinc-500/60 dark:text-white/40">
          <Image size={26} />
        </div>
        <div className={`h-2 w-2/3 rounded-full ${BAR_STRONG}`} />
      </div>
    ),
  },
  {
    id: "grid",
    top: "62%",
    left: "11%",
    depth: 36,
    rotate: 5,
    width: 210,
    delay: 0.3,
    children: (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-zinc-500/70 dark:text-white/40"><LayoutGrid size={13} /><div className={`h-2 w-16 rounded-full ${BAR_STRONG}`} /></div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`aspect-square rounded-md ${BAR_FAINT}`} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "cta",
    top: "66%",
    right: "12%",
    depth: 20,
    rotate: -5,
    width: 180,
    delay: 0.45,
    children: (
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-200"><Square size={16} /></span>
        <div className="flex-1 space-y-1.5">
          <div className={`h-2 w-full rounded-full ${BAR_STRONG}`} />
          <div className={`h-2 w-1/2 rounded-full ${BAR_FAINT}`} />
        </div>
      </div>
    ),
  },
];

function FloatingBlock({ block, px, py }: { block: Block; px: MotionValue<number>; py: MotionValue<number> }) {
  const x = useTransform(px, (v) => v * block.depth);
  const y = useTransform(py, (v) => v * block.depth);

  return (
    <motion.div
      style={{ x, y, top: block.top, left: block.left, right: block.right, width: block.width }}
      className="absolute hidden lg:block"
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay: block.delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [block.rotate, block.rotate + 1.5, block.rotate] }}
        transition={{ duration: 7 + block.depth * 0.1, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-2xl border border-zinc-900/10 bg-white/70 p-4 shadow-xl ring-1 ring-black/[0.04] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:shadow-2xl dark:ring-white/5"
      >
        {block.children}
      </motion.div>
    </motion.div>
  );
}

export function AuthBackground() {
  // normalized cursor offset from center, range roughly [-0.5, 0.5]
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const py = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });

  // glow follows the cursor in pixel space
  const glowX = useMotionValue(0.5);
  const glowY = useMotionValue(0.4);
  const glowXPct = useSpring(glowX, { stiffness: 80, damping: 20 });
  const glowYPct = useSpring(glowY, { stiffness: 80, damping: 20 });
  const glow = useTransform(
    [glowXPct, glowYPct] as unknown as MotionValue<number>[],
    ([gx, gy]: number[]) =>
      `radial-gradient(600px circle at ${gx * 100}% ${gy * 100}%, rgba(99,102,241,0.16), transparent 70%)`,
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      mx.set(nx);
      my.set(ny);
      glowX.set(e.clientX / window.innerWidth);
      glowY.set(e.clientY / window.innerHeight);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, glowX, glowY]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      {/* aurora color wash */}
      <div className="absolute -left-1/4 top-[-20%] h-[60vh] w-[60vh] rounded-full bg-indigo-400/25 blur-[120px] dark:bg-indigo-600/20" />
      <div className="absolute -right-1/4 bottom-[-20%] h-[55vh] w-[55vh] rounded-full bg-fuchsia-400/20 blur-[120px] dark:bg-fuchsia-600/15" />

      {/* grid (light): dark lines, masked to fade toward the edges */}
      <div
        className="absolute inset-0 opacity-70 dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(10,13,18,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,13,18,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 35%, transparent 100%)",
        }}
      />
      {/* grid (dark): light lines */}
      <div
        className="absolute inset-0 hidden opacity-60 dark:block"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 35%, transparent 100%)",
        }}
      />

      {/* cursor-following glow */}
      <motion.div className="absolute inset-0" style={{ background: glow }} />

      {/* floating, parallaxing product blocks */}
      {BLOCKS.map((b) => (
        <FloatingBlock key={b.id} block={b} px={px} py={py} />
      ))}

      {/* edge darken/lighten for card legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-100/70 via-transparent to-zinc-100/30 dark:from-zinc-950/70 dark:to-zinc-950/30" />
    </div>
  );
}
