import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created } from "@/lib/api/api-response";
import { createSite } from "@/lib/sites/create";

export const dynamic = "force-dynamic";

export async function GET() {
  return withWorkspace(async (ws) => {
    const sites = await prisma.site.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { createdAt: "asc" },
    });
    return json(sites);
  });
}

export async function POST(req: Request) {
  return withRole("ADMIN", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const site = await prisma.$transaction((tx) =>
      createSite(
        {
          workspaceId: ws.workspace.id,
          name: String(body?.name ?? ""),
          logoUrl: typeof body?.logoUrl === "string" ? body.logoUrl : null,
          faviconUrl: typeof body?.faviconUrl === "string" ? body.faviconUrl : null,
        },
        tx,
      ),
    );
    return created(site);
  });
}
