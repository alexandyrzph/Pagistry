import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSite } from "@/lib/sites/create";

const prisma = new PrismaClient();
const cleanup: { ws: string[] } = { ws: [] };

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: cleanup.ws } } });
  await prisma.$disconnect();
});

describe("createSite", () => {
  it("creates a site with a home page and links homePageId", async () => {
    const ws = await prisma.workspace.create({
      data: { name: "T", slug: `sites-api-${Date.now()}` },
    });
    cleanup.ws.push(ws.id);

    const result = await createSite({ workspaceId: ws.id, name: "Main site" });

    expect(result.name).toBe("Main site");
    expect(result.handle).toBe("main-site");
    expect(result.homePageId).toBeTruthy();

    const site = await prisma.site.findUniqueOrThrow({ where: { id: result.id } });
    expect(site.homePageId).toBe(result.homePageId);

    const page = await prisma.page.findUniqueOrThrow({ where: { id: result.homePageId } });
    expect(page.siteId).toBe(result.id);
    expect(page.slug).toBe("home");

    const branded = await createSite({
      workspaceId: ws.id,
      name: "Branded",
      logoUrl: "/logo.png",
      faviconUrl: "/fav.ico",
    });
    const brandedSite = await prisma.site.findUniqueOrThrow({ where: { id: branded.id } });
    expect(brandedSite.logoUrl).toBe("/logo.png");
    expect(brandedSite.faviconUrl).toBe("/fav.ico");
  });

  it("creates a site inside a caller-supplied transaction (atomic)", async () => {
    const ws = await prisma.workspace.create({
      data: { name: "T2", slug: `sites-api-tx-${Date.now()}` },
    });
    cleanup.ws.push(ws.id);

    await prisma.$transaction(async (tx) => {
      await createSite({ workspaceId: ws.id, name: "TX site" }, tx);
    });

    const sites = await prisma.site.findMany({ where: { workspaceId: ws.id } });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe("TX site");
  });

  it("rolls back if the transaction aborts after createSite", async () => {
    const ws = await prisma.workspace.create({
      data: { name: "T3", slug: `sites-api-rb-${Date.now()}` },
    });
    cleanup.ws.push(ws.id);

    await expect(
      prisma.$transaction(async (tx) => {
        await createSite({ workspaceId: ws.id, name: "Rollback site" }, tx);
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow("forced rollback");

    const sites = await prisma.site.findMany({ where: { workspaceId: ws.id } });
    expect(sites).toHaveLength(0);
  });
});
