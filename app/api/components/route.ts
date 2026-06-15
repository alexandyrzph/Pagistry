import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace, requireApiRole } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function safeParse(s: string) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// GET /api/components — list all reusable components
export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const comps = await prisma.component.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(
    comps.map((c) => ({
      id: c.id,
      name: c.name,
      content: safeParse(c.content),
      updatedAt: c.updatedAt.toISOString(),
    }))
  );
}

// POST /api/components — create from a block subtree
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "Component").slice(0, 80);
  const content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
  const c = await prisma.component.create({ data: { name, content, workspaceId: a.workspace.id } });
  return NextResponse.json({ id: c.id, name: c.name, content: safeParse(c.content) }, { status: 201 });
}
