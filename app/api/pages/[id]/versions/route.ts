import { prisma } from "@/lib/prisma";
import { withWorkspace, withRole } from "@/lib/api/api-handler";
import { json, created, notFound } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/pages/[id]/versions — lightweight list (no content)
export async function GET(_req: Request, { params }: Ctx) {
  return withWorkspace(async (ws) => {
    const { id } = await params;

    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();

    const versions = await prisma.pageVersion.findMany({
      where: { pageId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, createdAt: true },
      take: 100,
    });
    return json(
      versions.map((v) => ({ id: v.id, label: v.label, createdAt: v.createdAt.toISOString() }))
    );
  });
}

// POST /api/pages/[id]/versions — snapshot the page's current content + theme
export async function POST(req: Request, { params }: Ctx) {
  return withRole("EDITOR", async (ws) => {
    const { id } = await params;

    const page = await prisma.page.findFirst({ where: { id, workspaceId: ws.workspace.id } });
    if (!page) return notFound();

    const body = await req.json().catch(() => ({}));
    const label = String(body.label || "Manual save").slice(0, 80);

    const version = await prisma.pageVersion.create({
      data: { pageId: id, label, content: page.content, theme: page.theme },
    });

    // keep only the 30 most recent versions per page
    const old = await prisma.pageVersion.findMany({
      where: { pageId: id },
      orderBy: { createdAt: "desc" },
      skip: 30,
      select: { id: true },
    });
    if (old.length) {
      await prisma.pageVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }

    return created(
      { id: version.id, label: version.label, createdAt: version.createdAt.toISOString() }
    );
  });
}
