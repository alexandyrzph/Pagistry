"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, PanelBottom, PanelTop } from "lucide-react";
import { useEditorActions } from "./editor-actions";

export function SitePanel() {
  const router = useRouter();
  const { confirmLeave } = useEditorActions();
  const go = (path: string) => confirmLeave(() => router.push(path));

  return (
    <div className="space-y-2 p-3">
      <p className="px-1 pb-1 text-xs leading-relaxed text-zinc-400">
        The header and footer are <span className="font-medium text-zinc-500">shared across every page</span> — edit once, applies everywhere.
      </p>
      <SiteCard icon={<PanelTop size={15} />} title="Header" desc="Shown atop every page" onClick={() => go("/site/header")} />
      <SiteCard icon={<PanelBottom size={15} />} title="Footer" desc="Shown below every page" onClick={() => go("/site/footer")} />
    </div>
  );
}

function SiteCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2.5 text-left shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-zinc-700">{title}</span>
        <span className="block text-[10px] text-zinc-400">{desc}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-zinc-300 group-hover:text-indigo-500" />
    </motion.button>
  );
}
