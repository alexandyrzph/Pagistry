import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/page-service";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created } from "@/lib/api/api-response";
import { parseBody, createPageSchema } from "@/lib/api/schemas";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/pages — list pages in the active workspace (newest first)
export async function GET() {
  return withWorkspace(async (ws) => {
    const pages = await prisma.page.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { updatedAt: "desc" },
    });
    return json(pages);
  });
}

// POST /api/pages — create a page in the active workspace (editor+)
export async function POST(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const parsed = await parseBody(req, createPageSchema);
    if ("response" in parsed) return parsed.response;
    const title = (parsed.data.title || "Untitled Page").slice(0, 120);
    const slug = await uniqueSlug(title);
    const content = JSON.stringify(parsed.data.content ?? []);
    const page = await prisma.page.create({
      data: { title, slug, content, workspaceId: ws.workspace.id },
    });
    await logActivity(ws.workspace.id, ws.user.id, "page.created", page.id, { title });
    return created(page);
  });
}
