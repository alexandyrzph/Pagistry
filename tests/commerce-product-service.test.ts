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
vi.mock("@/lib/commerce/sync", () => ({ syncProductToStripe: vi.fn(async () => {}) }));

const prisma = new PrismaClient();
const wsIds: string[] = [];
afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("POST /api/products", () => {
  it("creates a product with a Default variant and rejects a duplicate handle", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    state.siteId = site.id;
    const { POST } = await import("@/app/api/products/route");

    const ok = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({ title: "Tee", handle: "tee" }),
      }),
    );
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.product.handle).toBe("tee");
    expect(body.product.variants.length).toBe(1);
    expect(state.roleCalls).toContain("EDITOR");

    const dup = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({ title: "Tee2", handle: "tee" }),
      }),
    );
    expect(dup.status).toBe(409);
  });
});
