import { describe, it, expect, afterAll, vi } from "vitest";
import { buildProductMap } from "@/lib/commerce/product-service";
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

describe("buildProductMap", () => {
  it("shapes rows into an id-keyed product map with parsed variants", () => {
    const map = buildProductMap([
      {
        id: "p1",
        handle: "tee",
        title: "Tee",
        description: "",
        status: "active",
        data: '{"vendor":"Acme"}',
        images: [{ url: "/a.png", alt: "", position: 0 }],
        variants: [
          {
            id: "v1",
            title: "S",
            options: '{"Size":"S"}',
            priceAmount: 1500,
            currency: "usd",
            inventory: 3,
            inventoryPolicy: "deny",
          },
        ],
      },
    ]);
    expect(map.p1.handle).toBe("tee");
    expect(map.p1.data.vendor).toBe("Acme");
    expect(map.p1.variants[0].priceAmount).toBe(1500);
    expect(map.p1.minPrice).toEqual({ amount: 1500, currency: "usd" });
  });
});
