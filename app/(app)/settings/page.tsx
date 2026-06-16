import { redirect } from "next/navigation";
import { requireWorkspace, hasRole } from "@/lib/auth/workspace";
import { SettingsClient } from "@/components/app-shell/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { workspace, role } = await requireWorkspace();
  if (!hasRole(role, "ADMIN")) redirect("/"); // only admins+ manage the workspace
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Workspace settings</h1>
      <p className="mt-1 text-sm text-zinc-500">{workspace.name}</p>
      <SettingsClient workspace={workspace} role={role} />
    </div>
  );
}
