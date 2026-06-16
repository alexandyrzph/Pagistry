import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api/api-handler";
import { json, notFound, error } from "@/lib/api/api-response";
import { isThumbnailStale } from "@/lib/thumbnails/staleness";
import { captureThumbnail } from "@/lib/thumbnails/screenshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// POST /api/pages/:id/thumbnail — (re)generate the preview screenshot if stale.
// Idempotent: returns the current image untouched when it's already fresh.
export async function POST(_req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;
    const page = await prisma.page.findFirst({
      where: { id, workspaceId: ws.workspace.id },
      include: { thumbnail: true },
    });
    if (!page) return notFound();

    if (page.thumbnail && !isThumbnailStale(page.thumbnail.takenForUpdatedAt, page.updatedAt)) {
      return json({ url: page.thumbnail.url, version: page.thumbnail.takenForUpdatedAt.getTime() });
    }

    try {
      const shot = await captureThumbnail(id);
      return json({ url: shot.url, version: shot.takenForUpdatedAt.getTime() });
    } catch (e) {
      console.error("[thumbnail] capture failed for", id, e);
      return error(500, "Thumbnail generation failed");
    }
  });
}
