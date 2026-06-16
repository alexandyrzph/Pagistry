import { requireApiUser } from "@/lib/auth/auth";
import { setActiveWorkspace } from "@/lib/auth/workspace";
import { json, forbidden } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// POST /api/workspaces/switch { id } — set the active workspace cookie
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const ok = await setActiveWorkspace(id);
  if (!ok) return forbidden("Not a member");
  return json({ ok: true });
}
