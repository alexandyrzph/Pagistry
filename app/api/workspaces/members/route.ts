import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace, requireApiRole, hasRole, type Role } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/workspaces/members — members of the active workspace (any member)
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const members = await prisma.membership.findMany({
    where: { workspaceId: a.workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    members.map((m) => ({ membershipId: m.id, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
  );
}

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

// PATCH /api/workspaces/members { membershipId, role } — change a role (admin+)
export async function PATCH(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const role = body.role as Role;
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Bad role" }, { status: 400 });
  // RBAC: you cannot grant a role above your own (prevents ADMIN self-escalation to OWNER)
  if (!hasRole(a.role, role)) return NextResponse.json({ error: "Cannot assign a role above your own" }, { status: 403 });
  const m = await prisma.membership.findFirst({ where: { id: String(body.membershipId), workspaceId: a.workspace.id } });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // never leave a workspace without an owner
  if (m.role === "OWNER" && role !== "OWNER") {
    const owners = await prisma.membership.count({ where: { workspaceId: a.workspace.id, role: "OWNER" } });
    if (owners <= 1) return NextResponse.json({ error: "Workspace needs an owner" }, { status: 400 });
  }
  await prisma.membership.update({ where: { id: m.id }, data: { role } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/workspaces/members?membershipId=... — remove a member (admin+)
export async function DELETE(req: Request) {
  const a = await requireApiRole("ADMIN");
  if ("response" in a) return a.response;
  const membershipId = new URL(req.url).searchParams.get("membershipId") || "";
  const m = await prisma.membership.findFirst({ where: { id: membershipId, workspaceId: a.workspace.id } });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.role === "OWNER") {
    const owners = await prisma.membership.count({ where: { workspaceId: a.workspace.id, role: "OWNER" } });
    if (owners <= 1) return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 });
  }
  await prisma.membership.delete({ where: { id: m.id } });
  return NextResponse.json({ ok: true });
}
