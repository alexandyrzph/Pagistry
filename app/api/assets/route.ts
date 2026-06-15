import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/assets — recent uploads for the active workspace (optionally filter to images with ?kind=image)
export async function GET(req: Request) {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const kind = new URL(req.url).searchParams.get("kind");
  const assets = await prisma.asset.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const filtered = kind === "image" ? assets.filter((x) => x.type.startsWith("image/")) : assets;
  return NextResponse.json(
    filtered.map((x) => ({ id: x.id, url: x.url, name: x.name, type: x.type, size: x.size }))
  );
}
