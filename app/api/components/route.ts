import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api-handler";
import { json, created } from "@/lib/api-response";
import { parseJsonArray } from "@/lib/json-parse";

export const dynamic = "force-dynamic";

// GET /api/components — list all reusable components
export async function GET() {
  return withWorkspace(async (ws) => {
    const comps = await prisma.component.findMany({
      where: { workspaceId: ws.workspace.id },
      orderBy: { updatedAt: "desc" },
    });
    return json(
      comps.map((c) => ({
        id: c.id,
        name: c.name,
        content: parseJsonArray(c.content),
        updatedAt: c.updatedAt.toISOString(),
      })),
    );
  });
}

// POST /api/components — create from a block subtree (editor+)
export async function POST(req: Request) {
  return withRole("EDITOR", async (ws) => {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "Component").slice(0, 80);
    const content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
    const c = await prisma.component.create({
      data: { name, content, workspaceId: ws.workspace.id },
    });
    return created({ id: c.id, name: c.name, content: parseJsonArray(c.content) });
  });
}
