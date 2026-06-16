import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/auth/workspace";
import { FormsClient } from "@/components/app-shell/FormsClient";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const { workspace } = await requireWorkspace();
  const pages = await prisma.page.findMany({
    where: { workspaceId: workspace.id, submissions: { some: {} } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  const dto = pages.map((p) => ({ id: p.id, title: p.title, count: p._count.submissions }));
  return <FormsClient pages={dto} />;
}
