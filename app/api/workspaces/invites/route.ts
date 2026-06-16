import { prisma } from "@/lib/prisma";
import { newToken } from "@/lib/auth/auth";
import { withRole } from "@/lib/api/api-handler";
import { type Role } from "@/lib/auth/workspace";
import { json, created, badRequest, notFound } from "@/lib/api/api-response";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]; // can't invite straight to OWNER

// GET /api/workspaces/invites — pending invites (admin+)
export async function GET() {
  return withRole("ADMIN", async (ws) => {
    const invites = await prisma.invite.findMany({
      where: { workspaceId: ws.workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return json(
      invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt.toISOString() })),
    );
  });
}

// POST /api/workspaces/invites { email, role } — create an invite, return its link (admin+)
export async function POST(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const role = (body.role === undefined ? "EDITOR" : body.role) as Role; // EDITOR is the default only when omitted
    if (!ROLES.includes(role)) return badRequest("Invalid role");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest("Valid email required");

    const token = newToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    await prisma.invite.create({ data: { workspaceId: ws.workspace.id, email, role, token, invitedById: ws.user.id, expiresAt } });
    await logActivity(ws.workspace.id, ws.user.id, "invite.sent", undefined, { email, role });

    const origin = new URL(req.url).origin;
    return created({ inviteUrl: `${origin}/invite/${token}` });
  });
}

// DELETE /api/workspaces/invites?id=... — revoke a pending invite (admin+)
export async function DELETE(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return badRequest("id required");
    await prisma.invite.deleteMany({ where: { id, workspaceId: ws.workspace.id } });
    return json({ ok: true });
  });
}
