import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/auth";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { needsSetup } from "@/lib/auth/setup-gate";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { SIDEBAR_COOKIE } from "@/components/app-shell/SidebarToggleCookie";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  const ctx = await getActiveWorkspace();
  const siteCount = ctx ? await prisma.site.count({ where: { workspaceId: ctx.workspace.id } }) : 0;
  if (needsSetup({ hasWorkspace: !!ctx, siteCount })) redirect("/setup");
  if (!ctx) redirect("/setup");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
  }));

  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#f7f8fa] md:flex-row">
      <Sidebar
        collapsed={collapsed}
        workspaces={workspaces}
        activeWorkspaceId={ctx.workspace.id}
        role={ctx.role}
        user={{ name: user.name, email: user.email }}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
