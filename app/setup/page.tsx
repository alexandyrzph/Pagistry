import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/auth";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { needsSetup } from "@/lib/auth/setup-gate";
import { SetupWizard } from "@/components/setup/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await requireUser();
  const ctx = await getActiveWorkspace();
  const siteCount = ctx ? await prisma.site.count({ where: { workspaceId: ctx.workspace.id } }) : 0;
  if (!needsSetup({ hasWorkspace: !!ctx, siteCount })) redirect("/");
  return <SetupWizard userName={user.name} hasWorkspace={!!ctx} />;
}
