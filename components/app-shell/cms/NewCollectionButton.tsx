"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NewCollectionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New collection" }),
    });
    const c = await res.json().catch(() => ({}));
    if (res.ok && c?.id) {
      router.push(`/cms/${c.id}`);
      router.refresh();
    } else {
      setBusy(false);
    }
  }
  return (
    <Button variant="neutral" onPress={create} isLoading={busy} leadingIcon={<Plus size={15} />}>New collection</Button>
  );
}
