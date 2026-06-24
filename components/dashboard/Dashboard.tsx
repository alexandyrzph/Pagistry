"use client";

import { motion } from "framer-motion";
import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { filterPages, emptyStateMessage } from "@/lib/dashboard/filter";
import { type Template } from "@/lib/blocks/templates";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { SubmissionsModal } from "./SubmissionsModal";
import { SegmentedFilter } from "./SegmentedFilter";
import { PageCard } from "./PageCard";
import {
  AiPageModal,
  EmptyState,
  TemplateModal,
  generatePage,
  runCreate,
  runRemove,
  useDashboardState,
  type PageItem,
} from "./Dashboard.helpers";

export function Dashboard({ pages }: { pages: PageItem[] }) {
  const s = useDashboardState(pages);

  const newParam = s.searchParams.get("new");
  if (newParam !== s.seenNewParam) {
    s.setSeenNewParam(newParam);
    if (newParam === "1") s.setModal(true);
  }

  const liveCount = s.counts.live;
  const filtered = filterPages(pages, s.query, s.filter);

  const openEditor = (id: string) => {
    s.router.refresh();
    s.router.push(`/editor/${id}`);
  };
  const create = (template: Template) =>
    runCreate(
      template,
      s.setCreating,
      (href) => s.router.push(href),
      () => s.router.refresh(),
    );
  const remove = (id: string) => runRemove(id, s.confirm, s.setDeleting, () => s.router.refresh());

  if (!s.ready) return <DashboardSkeleton />;

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
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#111827]">
              Your pages
            </h1>
            <p className="mt-2.5 text-[13.5px] text-[#6b7280]">
              {pages.length} {pages.length === 1 ? "page" : "pages"} · {liveCount} live · create,
              edit and publish in one click
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {s.hasAi && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => s.setAiModal(true)}
                className="flex h-[42px] items-center gap-2 rounded-[10px] border border-border bg-white px-4 text-[13.5px] font-medium text-fg transition-colors hover:bg-bg-subtle"
              >
                <Sparkles size={16} className="text-brand-600" /> Generate with AI
              </motion.button>
            )}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => s.setModal(true)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] bg-fg px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-fg/90"
            >
              <Plus size={16} /> New page
            </motion.button>
          </div>
        </div>

        {pages.length === 0 ? (
          <div className="mt-8">
            <EmptyState onCreate={() => s.setModal(true)} />
          </div>
        ) : (
          <>
            {/* toolbar */}
            <div className="my-6 flex flex-wrap items-center justify-between gap-4">
              <SegmentedFilter value={s.filter} onChange={s.setFilter} counts={s.counts} />
              <div className="flex w-[280px] max-w-full items-center gap-2.5 rounded-[10px] border border-[#e8eaed] bg-white px-3.5 py-2.5">
                <Search size={16} className="text-[#aeb4bd]" />
                <input
                  value={s.query}
                  onChange={(e) => s.setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="w-full bg-transparent text-[13.5px] text-[#111827] outline-none placeholder:text-[#aeb4bd]"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-[15px] font-semibold text-[#111827]">
                  {emptyStateMessage(s.query, s.filter)}
                </p>
                <Button
                  variant="link"
                  onPress={() => {
                    s.setQuery("");
                    s.setFilter("all");
                  }}
                  className="mt-2 text-[13.5px]"
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                {/* new page tile — first item; opens the template chooser */}
                <button
                  onClick={() => s.setModal(true)}
                  className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-110">
                    <Plus className="h-6 w-6 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 transition-colors group-hover:text-slate-900">
                    New page
                  </span>
                </button>
                {filtered.map((p, i) => (
                  <PageCard
                    key={p.id}
                    page={p}
                    index={i}
                    deleting={s.deleting === p.id}
                    onOpenSubmissions={() => s.setInbox({ id: p.id, title: p.title })}
                    onDelete={() => remove(p.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <TemplateModal
        open={s.modal}
        creating={s.creating}
        onClose={() => !s.creating && s.setModal(false)}
        onPick={create}
      />

      <AiPageModal
        open={s.aiModal}
        onClose={() => s.setAiModal(false)}
        onGenerate={generatePage}
        onDone={openEditor}
      />

      <SubmissionsModal page={s.inbox} onClose={() => s.setInbox(null)} />
    </div>
  );
}
