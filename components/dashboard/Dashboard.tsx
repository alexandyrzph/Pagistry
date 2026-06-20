"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/dialog-provider";
import { cn } from "@/lib/utils";
import { TEMPLATES, type Template } from "@/lib/blocks/templates";
import { filterPages, type DashboardFilter } from "@/lib/dashboard/filter";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { SubmissionsModal } from "./SubmissionsModal";
import { TemplatePreview } from "./TemplatePreview";
import { SegmentedFilter } from "./SegmentedFilter";
import { PageCard, type DashboardPage } from "./PageCard";

type PageItem = DashboardPage;

export function Dashboard({ pages }: { pages: PageItem[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [ready, setReady] = useState(false);
  const [inbox, setInbox] = useState<{ id: string; title: string } | null>(null);
  const [hasAi, setHasAi] = useState(false);
  const [aiModal, setAiModal] = useState(false);

  // Brief readiness gate so the loading skeleton is perceptible (incl. on refresh).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setHasAi(Array.isArray(d.providers) && d.providers.length > 0))
      .catch(() => {});
  }, []);

  // Open the new-page modal when ?new=1 is in the URL (e.g. from sidebar "New" button)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setModal(true);
      router.replace("/");
    }
  }, [searchParams, router]);

  async function generatePage(prompt: string): Promise<string | null> {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "page", prompt }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Generation failed");
    const blocks = d.blocks ?? [];
    const titled = blocks.find((b: any) => b?.props?.title)?.props?.title;
    const title = (titled || prompt).toString().slice(0, 60);
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content: blocks }),
    });
    const page = await res.json();
    return page.id ?? null;
  }

  const liveCount = pages.filter((p) => p.published).length;
  const counts = { all: pages.length, live: liveCount, drafts: pages.length - liveCount };
  const filtered = filterPages(pages, query, filter);

  async function create(template: Template) {
    setCreating(template.id);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: template.id === "blank" ? "Untitled Page" : `${template.name}`,
          content: template.build(),
        }),
      });
      const page = await res.json();
      router.push(`/editor/${page.id}`);
    } catch {
      setCreating(null);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete page?",
      message: "This page will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(id);
    try {
      await fetch(`/api/pages/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  if (!ready) return <DashboardSkeleton />;

  return (
    <div className="w-full">
      <main className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2.5 flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.04em] text-[#aeb4bd]">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#4b5563]">Pages</span>
            </div>
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#111827]">Your pages</h1>
            <p className="mt-2.5 text-[13.5px] text-[#6b7280]">
              {pages.length} {pages.length === 1 ? "page" : "pages"} · {liveCount} live · create, edit and publish in one click
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {hasAi && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAiModal(true)}
                className="flex h-[42px] items-center gap-2 rounded-[10px] border border-border bg-white px-4 text-[13.5px] font-medium text-fg transition-colors hover:bg-bg-subtle"
              >
                <Sparkles size={16} className="text-brand-600" /> Generate with AI
              </motion.button>
            )}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setModal(true)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] bg-fg px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-fg/90"
            >
              <Plus size={16} /> New page
            </motion.button>
          </div>
        </div>

        {pages.length === 0 ? (
          <div className="mt-8">
            <EmptyState onCreate={() => setModal(true)} />
          </div>
        ) : (
          <>
            {/* toolbar */}
            <div className="my-6 flex flex-wrap items-center justify-between gap-4">
              <SegmentedFilter value={filter} onChange={setFilter} counts={counts} />
              <div className="flex w-[280px] max-w-full items-center gap-2.5 rounded-[10px] border border-[#e8eaed] bg-white px-3.5 py-2.5">
                <Search size={16} className="text-[#aeb4bd]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="w-full bg-transparent text-[13.5px] text-[#111827] outline-none placeholder:text-[#aeb4bd]"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[15px] font-semibold text-[#111827]">No pages match “{query}”</p>
                <Button variant="link" onPress={() => { setQuery(""); setFilter("all"); }} className="mt-2 text-[13.5px]">Clear filters</Button>
              </div>
            ) : (
              <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                {/* new page tile — first item; opens the template chooser */}
                <button
                  onClick={() => setModal(true)}
                  className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-110">
                    <Plus className="h-6 w-6 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 transition-colors group-hover:text-slate-900">New page</span>
                </button>
                {filtered.map((p, i) => (
                  <PageCard
                    key={p.id}
                    page={p}
                    index={i}
                    deleting={deleting === p.id}
                    onOpenSubmissions={() => setInbox({ id: p.id, title: p.title })}
                    onDelete={() => remove(p.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <TemplateModal open={modal} creating={creating} onClose={() => !creating && setModal(false)} onPick={create} />

      <AiPageModal open={aiModal} onClose={() => setAiModal(false)} onGenerate={generatePage} onDone={(id) => router.push(`/editor/${id}`)} />

      <SubmissionsModal page={inbox} onClose={() => setInbox(null)} />
    </div>
  );
}

const AI_EXAMPLES = [
  "A landing page for a SaaS analytics tool",
  "A portfolio for a freelance designer",
  "A page for an eco-friendly coffee brand",
  "A launch page for a productivity app",
];

function AiPageModal({
  open,
  onClose,
  onGenerate,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<string | null>;
  onDone: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await onGenerate(p);
      if (id) onDone(id);
      else setError("Could not create the page.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} align="top" dismissible={!busy} className="max-w-lg overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-[#e8eaed] bg-white px-5 py-3.5">
          <Sparkles size={18} className="text-indigo-600" />
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-tight text-[#111827]">Generate a page with AI</h2>
            <p className="text-[11px] text-zinc-500">Describe your page — AI builds a full draft you can edit.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onPress={() => !busy && onClose()}><X size={18} /></Button>
        </div>
        <div className="p-5">
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            rows={3}
            placeholder="e.g. A landing page for a meal-planning app with pricing and testimonials"
            className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-800 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {AI_EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
              >
                {ex}
              </button>
            ))}
          </div>
          {error && <p className="mt-2.5 text-xs text-red-500">{error}</p>}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">⌘↵ to generate</span>
            <Button variant="neutral" onPress={run} isDisabled={!prompt.trim()} isLoading={busy} leadingIcon={<Sparkles size={15} />}>
              {busy ? "Generating page…" : "Generate page"}
            </Button>
          </div>
        </div>
    </Modal>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-20 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
        <Sparkles size={26} />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-zinc-900">Create your first page</h3>
      <p className="mb-5 mt-1 max-w-sm text-sm text-zinc-500">
        Start from a template or a blank canvas, then drag in blocks to build something beautiful.
      </p>
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-fg/90"
      >
        <Plus size={16} /> New page
      </motion.button>
    </motion.div>
  );
}

function TemplateModal({
  open,
  creating,
  onClose,
  onPick,
}: {
  open: boolean;
  creating: string | null;
  onClose: () => void;
  onPick: (t: Template) => void;
}) {
  // Build each template's block tree once (build() mints fresh ids each call).
  const built = useMemo(() => TEMPLATES.map((t) => ({ template: t, blocks: t.build() })), []);

  return (
    <Modal open={open} onClose={onClose} dismissible={!creating} className="max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900">Choose a starting point</h2>
          <p className="text-sm text-zinc-500">Pick a template or start from scratch.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onPress={onClose}><X size={18} /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {built.map(({ template: t, blocks }) => (
          <motion.div
            key={t.id}
            whileHover={creating ? undefined : { y: -2 }}
            whileTap={creating ? undefined : { scale: 0.98 }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 text-left shadow-xs transition-colors hover:border-indigo-300",
              creating && "pointer-events-none opacity-60",
            )}
          >
            <TemplatePreview blocks={blocks} />
            <div className="flex flex-col gap-1 p-4 transition-colors group-hover:bg-indigo-50/40">
              <span className="font-semibold tracking-tight text-zinc-900 group-hover:text-indigo-700">{t.name}</span>
              <span className="text-xs leading-snug text-zinc-500">{t.description}</span>
            </div>
            <button
              type="button"
              aria-label={`Use ${t.name} template`}
              disabled={!!creating}
              onClick={() => onPick(t)}
              className="absolute inset-0 rounded-xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-400 disabled:cursor-not-allowed"
            />
            {creating === t.id && (
              <span className="absolute right-3 top-3">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </Modal>
  );
}

