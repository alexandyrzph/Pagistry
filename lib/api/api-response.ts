const jsonHeaders = { "content-type": "application/json" } as const;

function build(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

/** Success envelope: data as-is with a status (default 200). */
export function json<T>(data: T, status = 200): Response {
  return build(data, status);
}

/** 201 Created. */
export function created<T>(data: T): Response {
  return build(data, 201);
}

/** Error envelope: { error: message } with a status. */
export function error(status: number, message: string): Response {
  return build({ error: message }, status);
}

export const badRequest = (message = "Bad request"): Response => error(400, message);
export const unauthorized = (message = "Unauthorized"): Response => error(401, message);
export const forbidden = (message = "Forbidden"): Response => error(403, message);
export const notFound = (message = "Not found"): Response => error(404, message);
