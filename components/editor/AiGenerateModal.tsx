"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { findBlockById } from "@/lib/tree";
import type { Block } from "@/lib/types";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { DESIGN_STYLE_OPTIONS } from "@/lib/ai";

const PROVIDER_LABELS: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", mock: "Mock" };

const EXAMPLES = [
  "A hero for a modern SaaS analytics product",
  "A pricing section with 3 tiers",
  "A features grid highlighting 3 benefits",
  "A testimonial from a happy customer",
  "A bold call-to-action to start a free trial",
];

export function AiGenerateModal() {
  const ai = useEditorUI((s) => s.ai);
  const close = useEditorUI((s) => s.closeAi);
  const insertTree = useEditor((s) => s.insertTree);
  const replaceTree = useEditor((s) => s.replaceTree);

  const [providers, setProviders] = useState<string[] | null>(null);
  const [provider, setProvider] = useState("");
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<"section" | "page">("section");
  const [style, setStyle] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ai) return;
    setError("");
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => {
        const list: string[] = Array.isArray(d.providers) ? d.providers : [];
        setProviders(list);
        setProvider((p) => (list.includes(p) ? p : list[0] ?? ""));
      })
      .catch(() => setProviders([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ai, close]);

  if (!ai) return null;

  const generate = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: p, provider, style, mode: scope === "page" ? "page" : "generate" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Generation failed");
        return;
      }
      const blocks = (d.blocks as Block[]) ?? [];
      if (scope === "page") {
        replaceTree(blocks);
      } else {
        const tree = useEditor.getState().tree;
        let index = ai.index;
        if (index < 0) index = ai.parentId ? findBlockById(tree, ai.parentId)?.children.length ?? 0 : tree.length;
        blocks.forEach((blk, i) => insertTree(blk, ai.parentId, index + i));
      }
      close();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const noProvider = providers !== null && providers.length === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[72] flex items-start justify-center bg-zinc-900/40 p-6 pt-[12vh] backdrop-blur-sm"
        onClick={close}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-white">
            <Sparkles size={18} />
            <div className="flex-1">
              <h2 className="text-sm font-bold tracking-tight">Generate with AI</h2>
              <p className="text-[11px] text-white/80">Describe a section and AI will build it on your page.</p>
            </div>
            <button onClick={close} className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            {noProvider ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                <p className="font-medium text-zinc-700">No AI provider configured</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Add <code className="rounded bg-zinc-200/70 px-1 text-[11px]">ANTHROPIC_API_KEY</code> or{" "}
                  <code className="rounded bg-zinc-200/70 px-1 text-[11px]">OPENAI_API_KEY</code> to your{" "}
                  <code className="rounded bg-zinc-200/70 px-1 text-[11px]">.env</code>, then restart.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 p-1">
                  {([
                    ["section", "Section"],
                    ["page", "Full page"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setScope(val)}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors",
                        scope === val ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Design style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DESIGN_STYLE_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setStyle(o.key)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          style === o.key
                            ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                            : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  autoFocus
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
                  }}
                  rows={3}
                  placeholder="e.g. A hero section for an eco-friendly coffee brand with a Shop now button"
                  className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-800 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                {scope === "page" && (
                  <p className="mt-2 text-[11px] text-amber-600">
                    Generates a full page and replaces the current content (undoable, and saved to version history).
                  </p>
                )}
                {error && <p className="mt-2.5 text-xs text-red-500">{error}</p>}

                <div className="mt-4 flex items-center justify-between gap-2">
                  {providers && providers.length > 1 ? (
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                      Model
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 outline-none"
                      >
                        {providers.map((p) => (
                          <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="text-[11px] text-zinc-400">⌘↵ to generate</span>
                  )}
                  <button
                    onClick={generate}
                    disabled={!prompt.trim() || busy}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {busy ? "Generating…" : "Generate"}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
