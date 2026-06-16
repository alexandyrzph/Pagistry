import { z } from "zod";
import { badRequest } from "./api-response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reusable email validator (regex matches the existing inline checks in auth routes). */
export const emailField = z.string().regex(EMAIL_RE, "Enter a valid email address.");

export const createPageSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.array(z.unknown()).optional(),
});

export const updateComponentSchema = z.object({
  name: z.string().max(80).optional(),
  content: z.array(z.unknown()).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;

/**
 * Read + validate a JSON request body. Mirrors the guard pattern:
 * returns `{ data }` on success or `{ response }` (400) on failure, so callers
 * unwrap with `if ("response" in parsed) return parsed.response;`.
 * Invalid JSON is treated as `{}` (same as the current `req.json().catch(() => ({}))`).
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { response: Response }> {
  const raw = await req.json().catch(() => ({}));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    return { response: badRequest(message) };
  }
  return { data: result.data };
}
