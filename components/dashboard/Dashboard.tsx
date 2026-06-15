"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { SubmissionsModal } from "./SubmissionsModal";

type PageItem = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  submissions: number;
};

const GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Dashboard({ pages }: { pages: PageItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q))
    : pages;

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
    if (!confirm("Delete this page? This cannot be undone.")) return;
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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Your pages</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {pages.length} {pages.length === 1 ? "page" : "pages"} · create, edit and publish in one click
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pages.length > 0 && (
              <div className="relative w-full sm:w-48">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            )}
            {hasAi && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAiModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
              >
                <Sparkles size={16} /> Generate with AI
              </motion.button>
            )}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
            >
              <Plus size={16} /> New page
            </motion.button>
          </div>
        </div>

        {pages.length === 0 ? (
          <EmptyState onCreate={() => setModal(true)} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-16 text-center">
            <p className="text-sm font-medium text-zinc-600">No pages match “{query}”.</p>
            <button
              onClick={() => setQuery("")}
              className="mt-2 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3, ease: "easeOut" }}
                whileHover={{ y: -4 }}
                className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs transition-shadow hover:shadow-lg"
              >
                <Link href={`/editor/${p.id}`} className="block">
                  <div className={cn("relative h-32 overflow-hidden bg-gradient-to-br", GRADIENTS[i % GRADIENTS.length])}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-black text-white/90 transition-transform duration-300 group-hover:scale-110">
                        {p.title.charAt(0).toUpperCase() || "P"}
                      </span>
                    </div>
                    {p.published && (
                      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 shadow-xs">
                        Live
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <Link href={`/editor/${p.id}`}>
                      <h3 className="truncate font-semibold tracking-tight text-zinc-900 transition-colors hover:text-indigo-600">{p.title}</h3>
                    </Link>
                    <p className="truncate text-xs text-zinc-400">/{p.slug} · {timeAgo(p.updatedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => setInbox({ id: p.id, title: p.title })}
                      title="Form submissions"
                      className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-indigo-600"
                    >
                      <Inbox size={15} />
                      {p.submissions > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                          {p.submissions}
                        </span>
                      )}
                    </button>
                    {p.published && (
                      <Link
                        href={`/p/${p.slug}`}
                        target="_blank"
                        title="View live"
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                      >
                        <ExternalLink size={15} />
                      </Link>
                    )}
                    <Link
                      href={`/editor/${p.id}`}
                      title="Edit"
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-indigo-600"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      disabled={deleting === p.id}
                      title="Delete"
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      {deleting === p.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {modal && (
          <TemplateModal
            creating={creating}
            onClose={() => !creating && setModal(false)}
            onPick={create}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiModal && (
          <AiPageModal
            onClose={() => setAiModal(false)}
            onGenerate={generatePage}
            onDone={(id) => router.push(`/editor/${id}`)}
          />
        )}
      </AnimatePresence>

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
  onClose,
  onGenerate,
  onDone,
}: {
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3.5 text-white">
          <Sparkles size={18} />
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-tight">Generate a page with AI</h2>
            <p className="text-[11px] text-white/80">Describe your page — AI builds a full draft you can edit.</p>
          </div>
          <button onClick={() => !busy && onClose()} className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white">
            <X size={18} />
          </button>
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
            <button
              onClick={run}
              disabled={!prompt.trim() || busy}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {busy ? "Generating page…" : "Generate page"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
        className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
      >
        <Plus size={16} /> New page
      </motion.button>
    </motion.div>
  );
}

function TemplateModal({
  creating,
  onClose,
  onPick,
}: {
  creating: string | null;
  onClose: () => void;
  onPick: (t: Template) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Choose a starting point</h2>
            <p className="text-sm text-zinc-500">Pick a template or start from scratch.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={!!creating}
              onClick={() => onPick(t)}
              className="group relative flex flex-col items-start gap-1 rounded-xl border border-zinc-200 p-4 text-left shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
            >
              <span className="font-semibold tracking-tight text-zinc-900 group-hover:text-indigo-700">{t.name}</span>
              <span className="text-xs leading-snug text-zinc-500">{t.description}</span>
              {creating === t.id && (
                <span className="absolute right-3 top-3">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

