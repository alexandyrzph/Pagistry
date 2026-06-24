"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/Button";
import { WorkspaceForm } from "./WorkspaceForm";
import { SiteForm } from "./SiteForm";
import { DomainStep } from "./DomainStep";
import { wizardSteps, type WizardStep } from "./wizard-steps";
import type { WorkspaceDraft, SiteDraft } from "./types";

export function SetupWizard({
  userName,
  hasWorkspace,
}: {
  userName: string;
  hasWorkspace: boolean;
}) {
  const router = useRouter();
  const steps = wizardSteps(hasWorkspace);
  const [i, setI] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceDraft>({
    name: userName ? `${userName}'s Workspace` : "",
    logoUrl: "",
  });
  const [site, setSite] = useState<SiteDraft>({ name: "", logoUrl: "", faviconUrl: "" });
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const step: WizardStep = steps[i];
  const canNext =
    step === "workspace"
      ? workspace.name.trim().length > 0
      : step === "site"
        ? site.name.trim().length > 0
        : true;

  async function finish() {
    setBusy(true);
    setErr("");
    try {
      await api.post(endpoints.setup, {
        workspace: hasWorkspace ? null : workspace,
        site,
      });
      const host = domain.trim();
      if (host) await api.post(endpoints.domains.list, { hostname: host }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch {
      setBusy(false);
      setErr("Something went wrong. Please try again.");
    }
  }

  function next() {
    if (i < steps.length - 1) setI(i + 1);
    else void finish();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-500">
        Step {i + 1} of {steps.length}
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">
        {step === "workspace" && "Create your workspace"}
        {step === "site" && "Create your website"}
        {step === "domain" && "Connect a domain"}
      </h1>

      {step === "workspace" && <WorkspaceForm value={workspace} onChange={setWorkspace} />}
      {step === "site" && <SiteForm value={site} onChange={setSite} />}
      {step === "domain" && <DomainStep value={domain} onChange={setDomain} />}

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" isDisabled={i === 0 || busy} onPress={() => setI(i - 1)}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {step === "domain" && (
            <Button variant="ghost" isDisabled={busy} onPress={() => void finish()}>
              Skip for now
            </Button>
          )}
          <Button isDisabled={!canNext || busy} onPress={next}>
            {i === steps.length - 1 ? (busy ? "Creating…" : "Finish") : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
