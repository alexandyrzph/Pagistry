"use client";

import { Field, TextInput } from "@/components/editor/controls";

export function DomainStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (hostname: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Custom domain (optional)">
        <TextInput value={value} onChange={onChange} placeholder="www.example.com" />
      </Field>
      <p className="text-xs leading-relaxed text-zinc-500">
        Add it now or later from Site settings. We&rsquo;ll guide you through the DNS records after
        setup.
      </p>
    </div>
  );
}
