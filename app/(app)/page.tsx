import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/auth";
import { requireWorkspace } from "@/lib/auth/workspace";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");

  const { workspace } = await requireWorkspace();

  const pages = await prisma.page.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  const dto = pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.published,
    updatedAt: p.updatedAt.toISOString(),
    submissions: p._count.submissions,
  }));
  return <Dashboard pages={dto} />;
}
