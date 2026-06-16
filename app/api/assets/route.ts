import { prisma } from "@/lib/prisma";
import { withWorkspace } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

// GET /api/assets — recent uploads for the active workspace (optionally filter to images with ?kind=image)
export async function GET(req: Request) {
  return withWorkspace(async (ws) => {
    const kind = new URL(req.url).searchParams.get("kind");
    const assets = await prisma.asset.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const filtered = kind === "image" ? assets.filter((x) => x.type.startsWith("image/")) : assets;
    return json(
      filtered.map((x) => ({ id: x.id, url: x.url, name: x.name, type: x.type, size: x.size }))
    );
  });
}
