"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Inbox, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageThumbnail } from "./PageThumbnail";

export type DashboardPage = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  submissions: number;
  thumbnailUrl: string | null;
  thumbnailVersion: number | null;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function IconBtn({
  label,
  danger,
  disabled,
  onClick,
  href,
  external,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "grid h-7 w-7 place-items-center rounded-[7px] border border-transparent text-[#6b7280] transition-colors",
    danger
      ? "hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      : "hover:border-[#d6dae0] hover:bg-zinc-100 hover:text-[#111827]",
    disabled && "pointer-events-none opacity-40",
  );
  if (href) {
    return (
      <Link href={href} title={label} className={cls} {...(external ? { target: "_blank" } : {})}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" title={label} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function PageCard({
  page,
  index,
  deleting,
  onOpenSubmissions,
  onDelete,
}: {
  page: DashboardPage;
  index: number;
  deleting: boolean;
  onOpenSubmissions: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3, ease: "easeOut" }}
      className="group overflow-hidden rounded-[14px] border border-[#e8eaed] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d6dae0] hover:shadow-lg"
    >
      {/* thumbnail */}
      <Link
        href={`/editor/${page.id}`}
        className="relative block aspect-[16/10] border-b border-[#eef0f2]"
      >
        <PageThumbnail
          title={page.title}
          initialUrl={page.thumbnailUrl}
          version={page.thumbnailVersion}
        />
        <span
          className={cn(
            "absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider shadow-sm ring-1 ring-black/[0.06] backdrop-blur-sm",
            page.published ? "bg-white/90 text-emerald-700" : "bg-white/90 text-zinc-600",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              page.published ? "bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {page.published ? "Live" : "Draft"}
        </span>
        <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-zinc-900/[0.04] opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white">
            <Pencil size={13} /> Open editor
          </span>
        </span>
      </Link>

      {/* meta */}
      <div className="flex items-start justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <Link href={`/editor/${page.id}`}>
            <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-[#111827] transition-colors hover:text-indigo-600">
              {page.title}
            </h3>
          </Link>
          <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11.5px] text-[#9aa1ac]">
            <span className="truncate">/{page.slug}</span>
            <span className="text-[#d6dae0]">·</span>
            <span className="whitespace-nowrap">{timeAgo(page.updatedAt)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="relative">
            <IconBtn label="Submissions" onClick={onOpenSubmissions}>
              <Inbox size={15} />
            </IconBtn>
            {page.submissions > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                {page.submissions}
              </span>
            )}
          </div>
          {page.published && (
            <IconBtn label="View live" href={`/p/${page.slug}`} external>
              <ExternalLink size={15} />
            </IconBtn>
          )}
          <IconBtn label="Edit" href={`/editor/${page.id}`}>
            <Pencil size={15} />
          </IconBtn>
          <IconBtn label="Delete" danger disabled={deleting} onClick={onDelete}>
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </IconBtn>
        </div>
      </div>
    </motion.div>
  );
}
