import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { hasRole, type Role } from "@/lib/auth/workspace";
import { json, badRequest, forbidden, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// GET /api/workspaces/members — members of the active workspace (any member)
export async function GET() {
  return withWorkspace(async (ws) => {
    const members = await prisma.membership.findMany({
      where: { workspaceId: ws.workspace.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return json(
      members.map((m) => ({ membershipId: m.id, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
    );
  });
}

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

// PATCH /api/workspaces/members { membershipId, role } — change a role (admin+)
export async function PATCH(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const role = body.role as Role;
    if (!ROLES.includes(role)) return badRequest("Bad role");
    // RBAC: you cannot grant a role above your own (prevents ADMIN self-escalation to OWNER)
    if (!hasRole(ws.role, role)) return forbidden("Cannot assign a role above your own");
    const m = await prisma.membership.findFirst({ where: { id: String(body.membershipId), workspaceId: ws.workspace.id } });
    if (!m) return notFound();
    // never leave a workspace without an owner
    if (m.role === "OWNER" && role !== "OWNER") {
      const owners = await prisma.membership.count({ where: { workspaceId: ws.workspace.id, role: "OWNER" } });
      if (owners <= 1) return badRequest("Workspace needs an owner");
    }
    await prisma.membership.update({ where: { id: m.id }, data: { role } });
    return json({ ok: true });
  });
}

// DELETE /api/workspaces/members?membershipId=... — remove a member (admin+)
export async function DELETE(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const membershipId = new URL(req.url).searchParams.get("membershipId") || "";
    const m = await prisma.membership.findFirst({ where: { id: membershipId, workspaceId: ws.workspace.id } });
    if (!m) return notFound();
    if (m.role === "OWNER") {
      const owners = await prisma.membership.count({ where: { workspaceId: ws.workspace.id, role: "OWNER" } });
      if (owners <= 1) return badRequest("Cannot remove the last owner");
    }
    await prisma.membership.delete({ where: { id: m.id } });
    return json({ ok: true });
  });
}
