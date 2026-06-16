"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { Editable } from "./shared";

type FormField = { label: string; type: string; required?: boolean };

export function FormBlock({ block, editable, style, className, id, setProp }: BlockRenderProps) {
  const {
    title = "Get in touch",
    description = "We'll get back to you within one business day.",
    fields = [] as FormField[],
    submitText = "Send message",
    successMessage = "Thanks! Your message has been sent.",
    formId = "contact",
  } = block.props;
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editable) return; // preview only inside the editor
    const form = e.currentTarget;
    const data: Record<string, string> = {};
    (fields as FormField[]).forEach((f) => {
      const el = form.elements.namedItem(f.label) as HTMLInputElement | null;
      if (el) data[f.label] = el.value;
    });
    const slug = window.location.pathname.split("/").filter(Boolean).pop() || "";
    setStatus("sending");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, formId, data }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="mb-8 text-center">
          <Editable as="h2" value={title} editable={editable} onCommit={(v) => setProp("title", v)}
            className="text-3xl font-bold text-slate-900" />
          <Editable as="p" value={description} editable={editable} onCommit={(v) => setProp("description", v)}
            className="mt-3 text-slate-500" />
        </div>

        {status === "done" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center font-medium text-emerald-700">
            {successMessage}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {(fields as FormField[]).map((f, i) => (
              <div key={i}>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea name={f.label} required={f.required} rows={4} className={inputCls} />
                ) : (
                  <input name={f.label} type={f.type || "text"} required={f.required} className={inputCls} />
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full cursor-pointer px-5 py-3 font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ backgroundColor: "var(--pc-brand, #6366f1)", borderRadius: "var(--pc-radius, 12px)" }}
            >
              {status === "sending" ? "Sending…" : submitText}
            </button>
            {status === "error" && (
              <p className="text-center text-sm text-rose-500">Something went wrong — please try again.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

