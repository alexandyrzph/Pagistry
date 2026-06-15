"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Network,
  Pencil,
  Redo2,
  Rocket,
  Save,
  Search,
  Sparkles,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor-store";
import { useEditorUI } from "@/store/editor-ui";
import { LogoMark } from "@/components/Brand";
import { useEditorActions } from "./editor-actions";
import { BreakpointSwitcher } from "./BreakpointSwitcher";
import { ZoomControl } from "./ZoomControl";

function SaveStatus() {
  const dirty = useEditor((s) => s.dirty);
  const saving = useEditor((s) => s.saving);
  const savedAt = useEditor((s) => s.savedAt);

  // While autosaving, show a shimmer "skeleton" indicator.
  if (saving) {
    return (
      <span className="hidden items-center gap-1.5 xl:inline-flex" aria-label="Saving">
        <span className="pc-skeleton h-3.5 w-3.5 rounded-full" />
        <span className="pc-skeleton h-3 w-12 rounded-full" />
      </span>
    );
  }

  const text = dirty ? "Unsaved" : savedAt ? "Saved" : "Ready";
  return (
    <span className="hidden items-center text-xs text-zinc-400 xl:inline-flex">
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
          dirty ? "bg-zinc-300" : "bg-emerald-500"
        )}
      />
      {text}
    </span>
  );
}

// Inline-editable page title: shows the title with a pencil affordance; click to
// edit, Enter/Escape or blur to commit (the store autosaves the change).
function InlineTitle() {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        placeholder="Untitled"
        className="w-36 rounded-lg bg-zinc-50 px-2 py-1.5 text-sm font-semibold tracking-tight text-zinc-800 outline-none ring-2 ring-indigo-100 md:w-52"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Rename"
      className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold tracking-tight text-zinc-800 transition-colors hover:bg-zinc-50"
    >
      <span className="max-w-[120px] truncate md:max-w-[200px]">{title || "Untitled"}</span>
      <Pencil size={12} className="shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

// Hover tooltip below a toolbar icon (CSS-only via group-hover — no JS/state).
function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
      {label}
    </span>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <motion.button
        whileTap={disabled ? undefined : { scale: 0.9 }}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "flex items-center justify-center rounded-lg p-2 transition-colors",
          active ? "bg-indigo-50 text-indigo-600" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
          disabled && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-zinc-500"
        )}
      >
        {icon}
      </motion.button>
      <Tooltip label={label} />
    </div>
  );
}

const Divider = () => <div className="mx-1 h-5 w-px bg-zinc-200" />;

export function TopBar({
  onSave,
  onExport,
  onPublish,
  onUnpublish,
  onOpenPalette,
  onOpenHistory,
  mode = "page",
}: {
  onSave: () => void;
  onExport: () => void;
  onPublish: () => void;
  onUnpublish?: () => void;
  onOpenPalette: () => void;
  onOpenHistory: () => void;
  mode?: "page" | "component" | "site" | "collection";
}) {
  const isComponentMode = mode === "component" || mode === "site" || mode === "collection";
  const previewMode = useEditor((s) => s.previewMode);
  const togglePreview = useEditor((s) => s.togglePreview);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const published = useEditor((s) => s.published);
  const slug = useEditor((s) => s.slug);
  const saving = useEditor((s) => s.saving);
  const domTree = useEditorUI((s) => s.domTree);
  const toggleDomTree = useEditorUI((s) => s.toggleDomTree);
  const router = useRouter();
  const { confirmLeave } = useEditorActions();
  const goHome = () => confirmLeave(() => router.push("/"));

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      {/* left: brand + breadcrumb */}
      <button
        onClick={goHome}
        title="Pagecraft — all pages"
        className="flex items-center rounded-lg transition-transform hover:scale-[1.04]"
      >
        <LogoMark size={30} className="rounded-lg shadow-sm ring-1 ring-black/5" />
      </button>
      <button
        onClick={goHome}
        className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 sm:inline"
      >
        Pages
      </button>
      <ChevronRight size={15} className="hidden shrink-0 text-zinc-300 sm:block" />
      <InlineTitle />
      <button
        onClick={onOpenPalette}
        title="Command palette (⌘K)"
        className="ml-1 hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600 lg:flex"
      >
        <Search size={13} />
        Search
        <kbd className="rounded bg-white px-1 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-200">
          ⌘K
        </kbd>
      </button>
      {mode === "page" && (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => useEditorUI.getState().openAi()}
          title="Generate a section with AI"
          className="ml-1 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">AI</span>
        </motion.button>
      )}

      {/* center: canvas zoom + responsive breakpoint switch */}
      <div className="mx-auto flex items-center gap-2">
        <ZoomControl />
        <BreakpointSwitcher />
      </div>

      {/* right: icon-only actions with tooltips */}
      <div className="flex items-center gap-0.5">
        <IconBtn icon={<Undo2 size={16} />} label="Undo (⌘Z)" onClick={undo} disabled={past === 0} />
        <IconBtn icon={<Redo2 size={16} />} label="Redo (⌘⇧Z)" onClick={redo} disabled={future === 0} />
        <Divider />
        <IconBtn icon={<Network size={16} />} label="DOM tree" onClick={toggleDomTree} active={domTree} />
        <IconBtn icon={<Eye size={16} />} label="Preview" onClick={togglePreview} active={previewMode} />
        <Divider />
        {mode === "page" && <IconBtn icon={<History size={16} />} label="Version history" onClick={onOpenHistory} />}
        {!isComponentMode && <IconBtn icon={<Download size={16} />} label="Export HTML" onClick={onExport} />}
        <IconBtn icon={<Save size={16} />} label="Save (⌘S)" onClick={onSave} />
        <SaveStatus />
        <div className="mx-1.5" />

        {isComponentMode ? (
          <button
            onClick={goHome}
            className="rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-violet-700"
          >
            Done
          </button>
        ) : published ? (
          <PublishedMenu slug={slug} onUnpublish={onUnpublish} />
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onPublish}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
          >
            <Rocket size={15} />
            <span className="hidden sm:inline">Publish</span>
          </motion.button>
        )}
      </div>

      {/* indeterminate autosave progress bar */}
      {saving && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
          <div
            className="h-full w-1/3 rounded-full bg-indigo-500"
            style={{ animation: "pc-progress 0.9s ease-in-out infinite" }}
          />
        </div>
      )}
    </header>
  );
}

// Published-state control: a green "Published" button that opens a menu with
// "View live" and "Unpublish".
function PublishedMenu({ slug, onUnpublish }: { slug: string; onUnpublish?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        <span className="hidden sm:inline">Published</span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 460, damping: 32 }}
              className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl ring-1 ring-black/5"
            >
              <a
                href={`/p/${slug}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                <ExternalLink size={15} className="text-zinc-400" />
                View live
              </a>
              <button
                onClick={() => {
                  setOpen(false);
                  onUnpublish?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <EyeOff size={15} />
                Unpublish
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
