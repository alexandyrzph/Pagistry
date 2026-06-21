import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET } from "@/app/api/domains/check/route";

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

function req(host: string) {
  return new Request(`http://localhost/api/domains/check?domain=${encodeURIComponent(host)}`);
}

describe("GET /api/domains/check", () => {
  it("200 for an ACTIVE host, 403 otherwise", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "ask-active.example", status: "ACTIVE" },
    });
    await prisma.domain.create({
      data: { siteId: site.id, hostname: "ask-pending.example", status: "PENDING" },
    });

    expect((await GET(req("ASK-Active.example"))).status).toBe(200);
    expect((await GET(req("ask-pending.example"))).status).toBe(403);
    expect((await GET(req("nope.example"))).status).toBe(403);
    expect((await GET(req(""))).status).toBe(403);
  });
});
