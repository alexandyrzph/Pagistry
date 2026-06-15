import { requireUser } from "@/lib/auth";
import { InviteAccept } from "@/components/app-shell/InviteAccept";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <InviteAccept token={token} />
    </div>
  );
}
