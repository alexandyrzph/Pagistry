import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nano = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  10
);

/** Short unique id for blocks (stable, URL-safe). */
export function uid(prefix = "b") {
  return `${prefix}_${nano()}`;
}

/** Make a URL-friendly slug from arbitrary text. */
export function slugify(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "page";
}
