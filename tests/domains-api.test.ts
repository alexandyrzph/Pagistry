import { describe, it, expect, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const state = vi.hoisted(() => ({ siteId: "", roleCalls: [] as string[] }));

vi.mock("@/lib/api/api-handler", () => ({
  withSite: (fn: (c: { site: { id: string } }) => unknown) => fn({ site: { id: state.siteId } }),
  withSiteRole: (min: string, fn: (c: { site: { id: string } }) => unknown) => {
    state.roleCalls.push(min);
    return fn({ site: { id: state.siteId } });
  },
}));

const prisma = new PrismaClient();
const wsIds: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("POST /api/domains", () => {
  it("rejects an invalid host, creates a valid one, and 409s a duplicate; requires ADMIN", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    state.siteId = site.id;
    state.roleCalls = [];
    const { POST } = await import("@/app/api/domains/route");

    const bad = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: "127.0.0.1" }),
      }),
    );
    expect(bad.status).toBe(400);

    const ok = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: `d-${Date.now()}.example` }),
      }),
    );
    expect(state.roleCalls).toContain("ADMIN");
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.domain.status).toBe("PENDING");
    expect(body.dns.ownership.type).toBe("TXT");

    const dupHost = body.domain.hostname;
    const dup = await POST(
      new Request("http://x/api/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: dupHost }),
      }),
    );
    expect(dup.status).toBe(409);
  });
});

describe("DELETE /api/domains/[id]", () => {
  it("requires ADMIN", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T2", slug: `t2-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({
      data: { workspaceId: ws.id, name: "S2", handle: `s2-${Date.now()}` },
    });
    state.siteId = site.id;
    state.roleCalls = [];
    const domain = await prisma.domain.create({
      data: { siteId: site.id, hostname: `del-${Date.now()}.example` },
    });
    const { DELETE } = await import("@/app/api/domains/[id]/route");
    await DELETE(new Request("http://x/api/domains/" + domain.id, { method: "DELETE" }), {
      params: Promise.resolve({ id: domain.id }),
    });
    expect(state.roleCalls).toContain("ADMIN");
  });
});

describe("POST /api/domains/[id]/verify", () => {
  it("requires ADMIN", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T3", slug: `t3-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({
      data: { workspaceId: ws.id, name: "S3", handle: `s3-${Date.now()}` },
    });
    state.siteId = site.id;
    state.roleCalls = [];
    const domain = await prisma.domain.create({
      data: { siteId: site.id, hostname: `ver-${Date.now()}.example` },
    });
    const { POST } = await import("@/app/api/domains/[id]/verify/route");
    await POST(new Request("http://x/api/domains/" + domain.id + "/verify", { method: "POST" }), {
      params: Promise.resolve({ id: domain.id }),
    });
    expect(state.roleCalls).toContain("ADMIN");
  });
});
