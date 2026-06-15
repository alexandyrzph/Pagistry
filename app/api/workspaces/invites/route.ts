import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newToken } from "@/lib/auth";
import { requireApiRole, type Role } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]; // can't invite straight to OWNER

// GET /api/workspaces/invites — pending invites (admin+)
export async function GET() {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const invites = await prisma.invite.findMany({
    where: { workspaceId: a.workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt.toISOString() })),
  );
}

// POST /api/workspaces/invites { email, role } — create an invite, return its link (admin+)
export async function POST(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const role = (body.role === undefined ? "EDITOR" : body.role) as Role; // EDITOR is the default only when omitted
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  const token = newToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  await prisma.invite.create({ data: { workspaceId: a.workspace.id, email, role, token, invitedById: a.user.id, expiresAt } });
  await logActivity(a.workspace.id, a.user.id, "invite.sent", undefined, { email, role });

  const origin = new URL(req.url).origin;
  return NextResponse.json({ inviteUrl: `${origin}/invite/${token}` }, { status: 201 });
}

// DELETE /api/workspaces/invites?id=... — revoke a pending invite (admin+)
export async function DELETE(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.invite.deleteMany({ where: { id, workspaceId: a.workspace.id } });
  return NextResponse.json({ ok: true });
}
