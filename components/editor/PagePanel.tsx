"use client";

import { useState } from "react";
import { useEditor } from "@/store/editor-store";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { Field, TextInput, Toggle } from "./controls";
import { SeoPanel } from "./SeoPanel";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-200 p-3">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function PagePanel() {
  const pageId = useEditor((s) => s.pageId);
  const slug = useEditor((s) => s.slug);
  const setSlug = useEditor((s) => s.setSlug);
  const published = useEditor((s) => s.published);
  const noindex = useEditor((s) => s.noindex);
  const setNoindex = useEditor((s) => s.setNoindex);
  const [slugErr, setSlugErr] = useState("");
  const [savedHome, setSavedHome] = useState(false);

  async function commitSlug() {
    if (!pageId) return;
    setSlugErr("");
    try {
      await api.put(endpoints.pages.byId(pageId), { slug });
    } catch {
      setSlugErr("That slug is taken or invalid.");
    }
  }

  async function commitNoindex(v: boolean) {
    setNoindex(v);
    if (pageId) await api.put(endpoints.pages.byId(pageId), { noindex: v }).catch(() => {});
  }

  async function setAsHome() {
    if (!pageId) return;
    await api.post(endpoints.pages.setHome(pageId), {}).catch(() => {});
    setSavedHome(true);
  }

  return (
    <div>
      <Section title="Page address">
        <Field label="Slug">
          <TextInput value={slug} onChange={setSlug} onBlur={commitSlug} placeholder="about-us" />
        </Field>
        {slugErr ? (
          <p className="mt-1 text-xs text-red-600">{slugErr}</p>
        ) : (
          published && (
            <p className="mt-1 text-[11px] text-amber-600">
              This page is live — changing the slug changes its public URL.
            </p>
          )
        )}
      </Section>

      <Section title="Status">
        <button
          onClick={() => void setAsHome()}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300"
        >
          {savedHome ? "Set as homepage ✓" : "Set as homepage"}
        </button>
      </Section>

      <Section title="Search">
        <label className="flex items-center justify-between">
          <span className="text-sm text-zinc-700">Hide from search engines</span>
          <Toggle value={noindex} onChange={(v) => void commitNoindex(v)} />
        </label>
      </Section>

      <SeoPanel />
    </div>
  );
}
