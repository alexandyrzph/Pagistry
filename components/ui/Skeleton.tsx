import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Compose with width/height/rounded classes. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("pc-skeleton rounded-md", className)} />;
}
