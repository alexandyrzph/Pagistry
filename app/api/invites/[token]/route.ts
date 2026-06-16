import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/auth";
import { setActiveWorkspace } from "@/lib/auth/workspace";
import { logActivity } from "@/lib/activity";
import { json, badRequest, forbidden, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// GET /api/invites/[token] — preview (workspace name + validity); no auth needed
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { token }, include: { workspace: true } });
  if (!invite) return notFound("Invalid invite");
  const valid = !invite.acceptedAt && invite.expiresAt > new Date();
  return json({ valid, email: invite.email, role: invite.role, workspaceName: invite.workspace.name });
}

// POST /api/invites/[token] — accept (must be signed in)
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return badRequest("Invite is invalid or expired");
  }
  // the accepting user must be the person the invite was addressed to
  if (invite.email.toLowerCase() !== u.user.email.toLowerCase()) {
    return forbidden("This invite was sent to a different email");
  }
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: u.user.id, workspaceId: invite.workspaceId } },
    update: {}, // existing members keep their role — role changes go through the members PATCH endpoint
    create: { userId: u.user.id, workspaceId: invite.workspaceId, role: invite.role },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await setActiveWorkspace(invite.workspaceId);
  await logActivity(invite.workspaceId, u.user.id, "member.joined", u.user.id, {});
  return json({ ok: true, workspaceId: invite.workspaceId });
}
