import { requireWorkspace } from "@/lib/auth/workspace";
import { DesignManager } from "@/components/app-shell/design/DesignManager";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  await requireWorkspace();
  return <DesignManager />;
}
