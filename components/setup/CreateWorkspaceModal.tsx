"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WorkspaceForm } from "./WorkspaceForm";
import { SiteForm } from "./SiteForm";
import type { WorkspaceDraft, SiteDraft } from "./types";

export function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDraft>({ name: "", logoUrl: "" });
  const [site, setSite] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { data } = await api.post(endpoints.setup, { workspace, site });
      if (data?.workspaceId)
        await api.post(endpoints.workspaces.switch, { id: data.workspaceId }).catch(() => {});
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <Modal onClose={onClose} className="max-w-md p-5">
      <div className="space-y-5">
        <h2 className="text-base font-semibold text-zinc-900">Create a new workspace</h2>
        <WorkspaceForm value={workspace} onChange={setWorkspace} />
        <div className="border-t border-zinc-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            First website
          </p>
          <SiteForm value={site} onChange={setSite} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" isDisabled={busy} onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={busy || !workspace.name.trim() || !site.name.trim()}
            onPress={() => void create()}
          >
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
