/** Parse a JSON string expected to hold an array. Returns [] on any failure or non-array. */
export function parseJsonArray<T = unknown>(s: string): T[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Parse a JSON string expected to hold a plain object. Returns {} on any failure or non-object. */
export function parseJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  s: string,
): T {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
