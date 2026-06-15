import { requireUser } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { AccountForm } from "@/components/app-shell/account/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  await requireWorkspace();
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Account</h1>
      <p className="mt-1 text-sm text-zinc-500">Manage your personal profile and security.</p>
      <AccountForm initialName={user.name} email={user.email} />
    </div>
  );
}
