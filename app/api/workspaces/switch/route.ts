import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { setActiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// POST /api/workspaces/switch { id } — set the active workspace cookie
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const ok = await setActiveWorkspace(id);
  if (!ok) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
