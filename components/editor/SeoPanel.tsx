"use client";

import { useEditor } from "@/store/editor-store";
import { Field, ImageInput, TextArea, TextInput } from "./controls";

export function SeoPanel() {
  const seo = useEditor((s) => s.seo);
  const setSeo = useEditor((s) => s.setSeo);
  const title = useEditor((s) => s.title);

  return (
    <div className="space-y-4 p-3">
      <Field label="Meta title">
        <TextInput
          value={seo.metaTitle ?? ""}
          onChange={(v) => setSeo({ metaTitle: v })}
          placeholder={title}
        />
      </Field>
      <Field label="Meta description">
        <TextArea
          value={seo.metaDescription ?? ""}
          onChange={(v) => setSeo({ metaDescription: v })}
          placeholder="A short description for search engines and social shares."
        />
      </Field>
      <Field label="Social image (Open Graph)">
        <ImageInput value={seo.ogImage ?? ""} onChange={(v) => setSeo({ ogImage: v })} />
      </Field>

      <div>
        <span className="mb-1.5 block text-[11px] font-medium text-zinc-500">Social preview</span>
        <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-xs">
          {seo.ogImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seo.ogImage} alt="" className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-black text-white/90">
              {(seo.metaTitle || title).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="space-y-1 border-t border-zinc-100 bg-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">pagistry.com</p>
            <p className="truncate text-sm font-semibold text-zinc-800">{seo.metaTitle || title}</p>
            <p className="line-clamp-2 text-xs text-zinc-500">
              {seo.metaDescription ||
                "Add a meta description to control how this page looks when shared."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
