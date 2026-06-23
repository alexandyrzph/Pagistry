import { requireSite } from "@/lib/auth/site";
import { hasRole } from "@/lib/auth/workspace";
import { SiteSettingsClient } from "@/components/app-shell/site/SiteSettingsClient";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  const ctx = await requireSite();
  const canManage = hasRole(ctx.role, "ADMIN");
  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Site settings</h1>
      <p className="mt-1 text-sm text-zinc-500">{ctx.site.name}</p>
      <SiteSettingsClient
        site={{ id: ctx.site.id, name: ctx.site.name, handle: ctx.site.handle }}
        canManage={canManage}
      />
    </div>
  );
}
