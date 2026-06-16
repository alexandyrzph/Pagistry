"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bold, Italic, Link2, List, ListOrdered, Loader2, Sparkles, Strikethrough, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRichText } from "@/store/richtext";
import { useIframe } from "./iframe-context";

const AI_ACTIONS: { key: string; label: string }[] = [
  { key: "improve", label: "Improve writing" },
  { key: "shorten", label: "Make shorter" },
  { key: "expand", label: "Make longer" },
  { key: "grammar", label: "Fix spelling & grammar" },
  { key: "professional", label: "More professional" },
  { key: "casual", label: "More casual" },
];

export function RichTextToolbar() {
  const editor = useRichText((s) => s.editor);
  const tick = useRichText((s) => s.tick);
  const { frame } = useIframe();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [hasAi, setHasAi] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  void tick;

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setHasAi(Array.isArray(d.providers) && d.providers.length > 0))
      .catch(() => {});
  }, []);

  if (!editor || (!editor.isFocused && !linkOpen && !aiOpen)) return null;

  let coords: { left: number; top: number } | null = null;
  try {
    const c = editor.view.coordsAtPos(editor.state.selection.from);
    const fb = frame?.el.getBoundingClientRect() ?? { left: 0, top: 0 };
    coords = { left: c.left + fb.left, top: c.top + fb.top };
  } catch {
    coords = null;
  }
  if (!coords) return null;

  const left = Math.max(8, Math.min(coords.left, window.innerWidth - 280));
  const top = Math.max(56, coords.top - 48);

  const run = (fn: () => void) => fn();
  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
    setLinkUrl("");
  };

  const aiRewrite = async (action: string) => {
    const sel = editor.state.selection;
    const hasSel = !sel.empty;
    const text = hasSel ? editor.state.doc.textBetween(sel.from, sel.to, " ") : editor.getText();
    if (!text.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "rewrite", action, text }),
      });
      const d = await r.json();
      if (r.ok && d.text) {
        if (hasSel) editor.chain().focus().insertContent(d.text).run();
        else editor.chain().focus().setContent(d.text).run();
      }
    } catch {
      /* ignore */
    } finally {
      setAiBusy(false);
      setAiOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[62] flex items-center gap-0.5 rounded-xl border border-zinc-700 bg-zinc-900 p-1 text-white shadow-2xl"
      style={{ left, top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <TBtn active={editor.isActive("bold")} onClick={() => run(() => editor.chain().focus().toggleBold().run())} title="Bold (⌘B)">
        <Bold size={14} />
      </TBtn>
      <TBtn active={editor.isActive("italic")} onClick={() => run(() => editor.chain().focus().toggleItalic().run())} title="Italic (⌘I)">
        <Italic size={14} />
      </TBtn>
      <TBtn active={editor.isActive("strike")} onClick={() => run(() => editor.chain().focus().toggleStrike().run())} title="Strikethrough">
        <Strikethrough size={14} />
      </TBtn>
      <Sep />
      <TBtn active={editor.isActive("bulletList")} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())} title="Bullet list">
        <List size={14} />
      </TBtn>
      <TBtn active={editor.isActive("orderedList")} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())} title="Numbered list">
        <ListOrdered size={14} />
      </TBtn>
      <Sep />
      {editor.isActive("link") ? (
        <TBtn active onClick={() => run(() => editor.chain().focus().unsetLink().run())} title="Remove link">
          <Unlink size={14} />
        </TBtn>
      ) : (
        <TBtn
          active={linkOpen}
          onClick={() => {
            setLinkUrl("");
            setLinkOpen((o) => !o);
          }}
          title="Add link"
        >
          <Link2 size={14} />
        </TBtn>
      )}
      {linkOpen && (
        <input
          autoFocus
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyLink();
            if (e.key === "Escape") setLinkOpen(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="https://…"
          className="ml-1 w-40 rounded-md bg-zinc-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:ring-indigo-400"
        />
      )}

      {hasAi && (
        <>
          <Sep />
          <div className="relative">
            <button
              title="Improve with AI"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAiOpen((o) => !o)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-lg px-1.5 text-[12px] font-semibold transition-colors",
                aiOpen ? "bg-indigo-600 text-white" : "text-indigo-600 hover:bg-indigo-50"
              )}
            >
              {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI
            </button>
            {aiOpen && (
              <div
                className="absolute left-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-2xl"
                onMouseDown={(e) => e.preventDefault()}
              >
                {AI_ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    disabled={aiBusy}
                    onClick={() => aiRewrite(a.key)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <Sparkles size={12} className="text-indigo-400" /> {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

function TBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        active ? "bg-indigo-500 text-white" : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-zinc-700" />;
}
