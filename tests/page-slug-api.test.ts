import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { validatePageSlug } from "@/lib/pages/validate-slug";

const prisma = new PrismaClient();
const wss: string[] = [];

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wss } } });
  await prisma.$disconnect();
});

describe("validatePageSlug", () => {
  it("rejects a slug already used by another page in the same site", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `slug-${Date.now()}` } });
    wss.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    await prisma.page.create({ data: { title: "A", slug: "about", siteId: site.id } });
    const target = await prisma.page.create({ data: { title: "B", slug: "b", siteId: site.id } });

    await expect(validatePageSlug(prisma, site.id, target.id, "About")).rejects.toThrow(
      "slug_taken",
    );

    const ok = await validatePageSlug(prisma, site.id, target.id, "Contact");
    expect(ok).toBe("contact");
  });
});
