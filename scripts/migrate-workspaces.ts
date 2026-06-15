import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "acme";
}

async function main() {
  // 1. default workspace (reuse if one already exists)
  let ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) {
    ws = await prisma.workspace.create({ data: { name: "Acme Inc", slug: slugify("Acme Inc") } });
    console.log("Created default workspace", ws.id, ws.slug);
  } else {
    console.log("Reusing existing workspace", ws.id, ws.slug);
  }

  // 2. every user becomes an OWNER of it
  const users = await prisma.user.findMany();
  for (const u of users) {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: u.id, workspaceId: ws.id } },
      update: {},
      create: { userId: u.id, workspaceId: ws.id, role: "OWNER" },
    });
  }
  console.log(`Ensured OWNER membership for ${users.length} user(s)`);

  // 3. attach all existing content (idempotent: only rows still unscoped)
  const r1 = await prisma.page.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r2 = await prisma.component.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r3 = await prisma.asset.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r4 = await prisma.collection.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  const r5 = await prisma.site.updateMany({ where: { workspaceId: null }, data: { workspaceId: ws.id } });
  console.log("Scoped:", { pages: r1.count, components: r2.count, assets: r3.count, collections: r4.count, sites: r5.count });
}

main()
  .then(() => console.log("Migration complete."))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
