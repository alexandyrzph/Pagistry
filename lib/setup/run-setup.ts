import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/lib/auth/workspace";
import { createSite } from "@/lib/sites/create";

export type SetupInput = {
  workspace: { name: string; logoUrl?: string | null } | null;
  site: { name: string; logoUrl?: string | null; faviconUrl?: string | null };
};

export async function runSetup(
  userId: string,
  input: SetupInput,
): Promise<{ workspaceId: string; siteId: string }> {
  let workspaceId = "";
  if (!input.workspace) {
    const m = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    if (!m) throw new Error("no_workspace");
    workspaceId = m.workspaceId;
  }
  return prisma.$transaction(async (tx) => {
    if (input.workspace) {
      const ws = await createWorkspace(
        { userId, name: input.workspace.name, logoUrl: input.workspace.logoUrl ?? null },
        tx,
      );
      workspaceId = ws.id;
    }
    const site = await createSite(
      {
        workspaceId,
        name: input.site.name,
        logoUrl: input.site.logoUrl ?? null,
        faviconUrl: input.site.faviconUrl ?? null,
      },
      tx,
    );
    return { workspaceId, siteId: site.id };
  });
}
