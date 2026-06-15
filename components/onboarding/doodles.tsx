"use client";

import { useId } from "react";
import { motion } from "framer-motion";

// Original hand-drawn "doodle" characters in a warm ink + gold + cream line-art
// style (friendly faces peeking from textured frames, little props, halftone &
// stripe fills). Inspired by the playful illustrated aesthetic — drawn from
// scratch as simple SVG. Each gently animates.

type DoodleProps = { className?: string; accent?: string };

const INK = "#2b2622";
const CREAM = "#fbf6ec";
const GOLD = "#caa45e";

const line = {
  fill: "none",
  stroke: INK,
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const float = {
  animate: { y: [0, -8, 0] },
  transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const },
};

/** Reusable face: cream oval, friendly eyes, smile, rosy cheeks. */
function Face({ x, y, accent = GOLD }: { x: number; y: number; accent?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="26" ry="24" fill={CREAM} stroke={INK} strokeWidth={4} />
      <circle cx="-9" cy="-3" r="2.6" fill={INK} />
      <circle cx="9" cy="-3" r="2.6" fill={INK} />
      <circle cx="-15" cy="6" r="4.5" fill={accent} opacity={0.55} />
      <circle cx="15" cy="6" r="4.5" fill={accent} opacity={0.55} />
      <path d="M-8 8 Q0 16 8 8" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  );
}

/** A striped or dotted texture swatch behind a frame. */
function Texture({ id, kind }: { id: string; kind: "stripes" | "dots" }) {
  return (
    <defs>
      {kind === "stripes" ? (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill={CREAM} />
          <rect width="4.5" height="9" fill={GOLD} opacity={0.85} />
        </pattern>
      ) : (
        <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse">
          <rect width="11" height="11" fill={CREAM} />
          <circle cx="3" cy="3" r="2.1" fill={GOLD} opacity={0.85} />
        </pattern>
      )}
    </defs>
  );
}

/** Welcome — a friendly face in a striped frame, waving. */
export function DoodleWave({ className, accent = GOLD }: DoodleProps) {
  const tx = useId();
  return (
    <motion.svg viewBox="0 0 240 240" className={className} {...float}>
      <Texture id={tx} kind="stripes" />
      <rect x="70" y="72" width="100" height="100" rx="30" fill={`url(#${tx})`} stroke={INK} strokeWidth={4.5} />
      <rect x="70" y="72" width="100" height="100" rx="30" fill={CREAM} opacity={0.45} stroke="none" />
      <Face x={120} y={122} accent={accent} />
      <path d="M120 96 q-14 -6 -10 -20" {...line} />
      <motion.g style={{ transformOrigin: "168px 138px" }} animate={{ rotate: [0, 20, 0, 20, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4 }}>
        <path d="M168 138 q26 -2 28 -30" {...line} />
        <circle cx="196" cy="106" r="9" fill={CREAM} stroke={INK} strokeWidth={4} />
      </motion.g>
      <path d="M150 58 l4 -12 M176 70 l11 -7 M58 96 l-12 -3" stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </motion.svg>
  );
}

/** Build — a face peeking over a stack of cross-hatched boxes. */
export function DoodleBuild({ className, accent = GOLD }: DoodleProps) {
  const tx = useId();
  return (
    <motion.svg viewBox="0 0 240 240" className={className} {...float}>
      <Texture id={tx} kind="dots" />
      <rect x="78" y="40" width="84" height="84" rx="26" fill={`url(#${tx})`} stroke={INK} strokeWidth={4.5} />
      <rect x="78" y="40" width="84" height="84" rx="26" fill={CREAM} opacity={0.5} stroke="none" />
      <Face x={120} y={84} accent={accent} />
      {/* stacked boxes */}
      <g>
        <rect x="56" y="150" width="50" height="40" rx="6" fill={CREAM} stroke={INK} strokeWidth={4} />
        <rect x="116" y="150" width="50" height="40" rx="6" fill={CREAM} stroke={INK} strokeWidth={4} />
        <motion.rect x="86" y="126" width="50" height="40" rx="6" fill={GOLD} opacity={0.85} stroke={INK} strokeWidth={4}
          animate={{ y: [126, 118, 126] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
        <path d="M56 170 h50 M116 170 h50 M86 146 h50" {...line} strokeWidth={3} opacity={0.5} />
      </g>
    </motion.svg>
  );
}

/** Magic — a face with a wand casting a gold sparkle (AI). */
export function DoodleMagic({ className, accent = "#b58bd6" }: DoodleProps) {
  const tx = useId();
  return (
    <motion.svg viewBox="0 0 240 240" className={className} {...float}>
      <Texture id={tx} kind="dots" />
      <rect x="56" y="74" width="100" height="100" rx="30" fill={`url(#${tx})`} stroke={INK} strokeWidth={4.5} />
      <rect x="56" y="74" width="100" height="100" rx="30" fill={CREAM} opacity={0.5} stroke="none" />
      <Face x={106} y={124} accent={accent} />
      <motion.g style={{ transformOrigin: "150px 150px" }} animate={{ rotate: [-7, 9, -7] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
        <path d="M148 152 L196 92" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <path d="M196 92 l6 -12 l4 13 l13 3 l-12 6 l1 13 l-9 -8 l-12 5 l5 -12 l-9 -8 z" fill={GOLD} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      </motion.g>
      {[ [60, 60], [182, 150], [70, 182] ].map(([x, y], k) => (
        <motion.path key={k} d={`M${x} ${y-9} v18 M${x-9} ${y} h18`} stroke={GOLD} strokeWidth={3.5} strokeLinecap="round"
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.1, 0.7] }} transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.4 }} style={{ transformOrigin: `${x}px ${y}px` }} />
      ))}
    </motion.svg>
  );
}

/** Publish — a friendly face riding a little rocket. */
export function DoodlePublish({ className, accent = GOLD }: DoodleProps) {
  const tx = useId();
  return (
    <motion.svg viewBox="0 0 240 240" className={className} {...float}>
      <Texture id={tx} kind="stripes" />
      <path d="M120 40 C150 66 156 112 150 152 L90 152 C84 112 90 66 120 40 Z" fill={`url(#${tx})`} stroke={INK} strokeWidth={4.5} />
      <path d="M120 40 C150 66 156 112 150 152 L90 152 C84 112 90 66 120 40 Z" fill={CREAM} opacity={0.4} stroke="none" />
      <circle cx="120" cy="96" r="22" fill={CREAM} stroke={INK} strokeWidth={4} />
      <Face x={120} y={98} accent={accent} />
      <path d="M90 150 L66 182 L92 170 M150 150 L174 182 L148 170" {...line} fill={CREAM} />
      <motion.path d="M106 174 q14 30 28 0" stroke={GOLD} strokeWidth={6} strokeLinecap="round" fill="none"
        animate={{ scaleY: [0.6, 1.25, 0.6], opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.5, repeat: Infinity }} style={{ transformOrigin: "120px 174px" }} />
      <path d="M150 64 l12 -6 M168 92 l13 0" stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </motion.svg>
  );
}

/** Celebrate — a cheering face in a frame with confetti. */
export function DoodleConfetti({ className, accent = GOLD }: DoodleProps) {
  const tx = useId();
  const bits = [ [52, 60, GOLD], [188, 70, INK], [66, 184, GOLD], [186, 172, INK], [120, 38, GOLD] ] as const;
  return (
    <motion.svg viewBox="0 0 240 240" className={className} {...float}>
      <Texture id={tx} kind="dots" />
      <rect x="72" y="84" width="96" height="96" rx="30" fill={`url(#${tx})`} stroke={INK} strokeWidth={4.5} />
      <rect x="72" y="84" width="96" height="96" rx="30" fill={CREAM} opacity={0.5} stroke="none" />
      <Face x={120} y={132} accent={accent} />
      {/* raised arms */}
      <path d="M84 116 Q62 84 66 74 M156 116 Q178 84 174 74" {...line} />
      {bits.map(([x, y, c], k) => (
        <motion.rect key={k} x={x as number} y={y as number} width="11" height="11" rx="2.5" fill={c as string}
          animate={{ y: [y as number, (y as number) - 14, y as number], rotate: [0, 100, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: k * 0.25 }} style={{ transformOrigin: `${x}px ${y}px` }} />
      ))}
    </motion.svg>
  );
}
