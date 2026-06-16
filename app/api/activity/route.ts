import { prisma } from "@/lib/prisma";
import { withWorkspace } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";
import { parseJsonObject } from "@/lib/api/json-parse";

export const dynamic = "force-dynamic";

export async function GET() {
  return withWorkspace(async (ws) => {
    const events = await prisma.activityEvent.findMany({
      where: { workspaceId: ws.workspace.id },
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

    return json(
      events.map((e) => ({
        id: e.id,
        type: e.type,
        targetId: e.targetId,
        meta: parseJsonObject(e.meta),
        actor: byId.get(e.actorId)?.name || byId.get(e.actorId)?.email || "Someone",
        createdAt: e.createdAt.toISOString(),
      }))
    );
  });
}
