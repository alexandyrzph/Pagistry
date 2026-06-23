import Link from "next/link";
import { PanelTop, PanelBottom, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSite } from "@/lib/auth/site";
import { parseContent } from "@/lib/page-service";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const ctx = await requireSite();
  const site = await prisma.site.findFirst({ where: { id: ctx.site.id } });

  const headerCount = parseContent(site?.header ?? "[]").length;
  const footerCount = parseContent(site?.footer ?? "[]").length;

  const sections = [
    {
      href: "/site/header",
      icon: PanelTop,
      label: "Header",
      description:
        "The global navigation and branding bar rendered at the top of every published page.",
      blockCount: headerCount,
    },
    {
      href: "/site/footer",
      icon: PanelBottom,
      label: "Footer",
      description:
        "Links, legal text, and other content shown at the bottom of every published page.",
      blockCount: footerCount,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Site</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Global regions that render on every published page in your workspace.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map(({ href, icon: Icon, label, description, blockCount }) => (
          <div
            key={href}
            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100">
              <Icon size={20} className="text-zinc-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-800">{label}</p>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{description}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {blockCount} block{blockCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Edit {label} <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
