"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Blocks,
  Database,
  Globe,
  Layers as LayersIcon,
  Layout as LayoutIcon,
  Palette as PaletteIcon,
  PanelsTopLeft,
  Plug,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Palette } from "./Palette";
import { Layers } from "./Layers";
import { PagesPanel } from "./PagesPanel";
import { ReusableComponents } from "./ReusableComponents";
import { ThemePanel } from "./ThemePanel";
import { SeoPanel } from "./SeoPanel";
import { CmsPanel } from "./CmsPanel";
import { SitePanel } from "./SitePanel";

type Section = "add" | "layers" | "pages" | "site" | "cms" | "integrations" | "theme" | "seo";

const RAIL: { id: Section; label: string; icon: typeof Blocks }[] = [
  { id: "add", label: "Blocks", icon: Blocks },
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "pages", label: "Pages", icon: PanelsTopLeft },
  { id: "site", label: "Site", icon: LayoutIcon },
  { id: "theme", label: "Design", icon: PaletteIcon },
  { id: "seo", label: "SEO", icon: Globe },
  { id: "cms", label: "CMS", icon: Database },
  { id: "integrations", label: "Connect", icon: Plug },
];

const TITLES: Record<Section, string> = {
  add: "Components",
  layers: "Layers",
  pages: "Pages",
  site: "Header & Footer",
  cms: "CMS Collections",
  integrations: "Integrations",
  theme: "Design system",
  seo: "SEO & sharing",
};

export function LeftPanel() {
  const [section, setSection] = useState<Section>("add");

  return (
    <aside className="flex shrink-0">
      {/* icon rail */}
      <div className="flex w-[54px] flex-col items-center gap-1 overflow-y-auto border-r border-zinc-200 bg-white py-2.5">
        {RAIL.map((r) => (
          <RailBtn key={r.id} active={section === r.id} onClick={() => setSection(r.id)} icon={<r.icon size={18} />} label={r.label} />
        ))}
      </div>

      {/* nested panel */}
      <div className="flex w-60 flex-col border-r border-zinc-200 bg-zinc-50/60">
        <div className="flex h-11 shrink-0 items-center border-b border-zinc-200 px-3.5">
          <span className="text-sm font-semibold tracking-tight text-zinc-800">{TITLES[section]}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              {section === "add" && (
                <>
                  <Palette />
                  <div className="px-3 pb-5">
                    <h3 className="mb-2.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                      <Sparkles size={11} /> My components
                    </h3>
                    <ReusableComponents />
                  </div>
                </>
              )}
              {section === "layers" && <Layers />}
              {section === "pages" && (
                <div className="p-3">
                  <PagesPanel />
                </div>
              )}
              {section === "site" && <SitePanel />}
              {section === "theme" && <ThemePanel />}
              {section === "seo" && <SeoPanel />}
              {section === "cms" && <CmsPanel />}
              {section === "integrations" && (
                <Placeholder
                  icon={<Plug size={20} className="text-zinc-400" />}
                  title="Integrations"
                  body="Connect Analytics, forms, email and payments. Integrations are on the roadmap."
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function RailBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-[9px] font-semibold transition-colors",
        active ? "bg-indigo-50 text-indigo-600" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-600"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

function Placeholder({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-12 text-center">
      <div className="rounded-xl bg-zinc-100 p-3">{icon}</div>
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      <p className="text-xs leading-relaxed text-zinc-400">{body}</p>
      <span className="mt-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Coming soon
      </span>
    </div>
  );
}
