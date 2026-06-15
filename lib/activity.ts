import { prisma } from "./prisma";

/** Best-effort activity log. Never throws — logging must not break a mutation. */
export async function logActivity(
  workspaceId: string,
  actorId: string,
  type: string,
  targetId?: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: { workspaceId, actorId, type, targetId, meta: JSON.stringify(meta) },
    });
  } catch {
    /* swallow — activity is non-critical */
  }
}
