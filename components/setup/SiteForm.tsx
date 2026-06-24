"use client";

import { Field, TextInput, ImageInput } from "@/components/editor/controls";
import type { SiteDraft } from "./types";

export function SiteForm({
  value,
  onChange,
}: {
  value: SiteDraft;
  onChange: (v: SiteDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Website name">
        <TextInput
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
          placeholder="Marketing site"
        />
      </Field>
      <Field label="Website image">
        <ImageInput value={value.logoUrl} onChange={(logoUrl) => onChange({ ...value, logoUrl })} />
      </Field>
      <Field label="Favicon">
        <ImageInput
          value={value.faviconUrl}
          onChange={(faviconUrl) => onChange({ ...value, faviconUrl })}
        />
      </Field>
    </div>
  );
}
