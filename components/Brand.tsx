import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pagecraft brand identity.
// The mark is a layout/blocks motif (a left rail + content blocks) — it reads
// as "page builder" and works on any background.
// ---------------------------------------------------------------------------

export function LogoMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9.5" fill="url(#pc-logo-grad)" />
      <rect width="36" height="36" rx="9.5" fill="url(#pc-logo-sheen)" fillOpacity="0.18" />
      <rect x="9" y="9.5" width="5.5" height="17" rx="2" fill="#fff" />
      <rect x="17.5" y="9.5" width="9.5" height="5" rx="1.6" fill="#fff" fillOpacity="0.95" />
      <rect x="17.5" y="17.5" width="9.5" height="9" rx="2" fill="#fff" fillOpacity="0.55" />
      <defs>
        <linearGradient id="pc-logo-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="pc-logo-sheen" x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  size = 34,
  wordmark = true,
  className,
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="rounded-[9.5px] shadow-sm ring-1 ring-black/5" />
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-zinc-900">
            Pagecraft
          </span>
          <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Studio
          </span>
        </span>
      )}
    </span>
  );
}
