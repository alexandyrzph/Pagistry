"use client";

import { Field, TextInput, ImageInput } from "@/components/editor/controls";
import type { WorkspaceDraft } from "./types";

export function WorkspaceForm({
  value,
  onChange,
}: {
  value: WorkspaceDraft;
  onChange: (v: WorkspaceDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Workspace name">
        <TextInput
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
          placeholder="Acme Inc."
        />
      </Field>
      <Field label="Workspace logo">
        <ImageInput value={value.logoUrl} onChange={(logoUrl) => onChange({ ...value, logoUrl })} />
      </Field>
    </div>
  );
}
