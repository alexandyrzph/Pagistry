import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;

  const events = await prisma.activityEvent.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // resolve actor names in one query
  const actorIds = [...new Set(events.map((e) => e.actorId))];
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      targetId: e.targetId,
      meta: safe(e.meta),
      actor: byId.get(e.actorId)?.name || byId.get(e.actorId)?.email || "Someone",
      createdAt: e.createdAt.toISOString(),
    }))
  );
}

function safe(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
