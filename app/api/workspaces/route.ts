import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/workspaces — the current user's workspaces (with their role)
export async function GET() {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const memberships = await prisma.membership.findMany({
    where: { userId: u.user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
    })),
  );
}

// POST /api/workspaces — create a workspace (current user becomes OWNER)
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const ws = await createWorkspace(u.user.id, name);
  return NextResponse.json(ws, { status: 201 });
}
