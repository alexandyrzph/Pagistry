"use client";

import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/registry-types";
import type { CardBindings } from "@/lib/types";
import { resolveCards, type ResolvedCard } from "@/lib/cms";
import { useCollections } from "@/components/editor/collections-context";

// Collection List — repeats a card template across a CMS collection's items.
// Field-to-slot bindings come from the inspector; collection data is resolved
// from context (provided by the editor and by BlockRenderer on the public page).

export function CollectionListBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const { map } = useCollections();
  const {
    collectionId = "",
    layout = "grid",
    columns = "3",
    limit = 0,
    bindings = {} as CardBindings,
  } = block.props;

  const collection = collectionId ? map[collectionId] : undefined;

  // Unbound / missing collection.
  if (!collection) {
    if (!editable) return null;
    return (
      <Shell id={id} className={className} style={style}>
        <Placeholder
          title="Collection List"
          body="Pick a collection and map its fields in the inspector to start showing dynamic content here."
        />
      </Shell>
    );
  }

  const cards = resolveCards(collection.items, bindings as CardBindings, Number(limit) || 0);

  if (cards.length === 0) {
    if (!editable) return null;
    return (
      <Shell id={id} className={className} style={style}>
        <Placeholder
          title={`“${collection.name}” has no items yet`}
          body="Add items to this collection in the CMS panel and they'll appear here automatically."
        />
      </Shell>
    );
  }

  const isList = layout === "list";
  const cols = Math.max(1, Math.min(Number(columns) || 3, 4));
  // When the collection has detail pages enabled, cards link to them by default.
  const linked = collection.detailEnabled
    ? cards.map((c) => ({ ...c, link: c.link || `/c/${collection.slug}/${c.id}` }))
    : cards;

  return (
    <Shell className={className} style={style}>
      <div
        className={cn("grid gap-6", isList && "gap-4")}
        style={{ gridTemplateColumns: isList ? "1fr" : `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {linked.map((c) => (
          <Card key={c.id} card={c} list={isList} editable={editable} />
        ))}
      </div>
    </Shell>
  );
}

function Shell({
  className,
  style,
  id,
  children,
}: {
  className: string;
  style: React.CSSProperties;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-6xl px-6 py-16">{children}</div>
    </section>
  );
}

function Card({
  card,
  list,
  editable,
}: {
  card: ResolvedCard;
  list: boolean;
  editable: boolean;
}) {
  const clickable = !!card.link && !editable;
  const Tag: any = clickable ? "a" : "div";
  const tagProps = clickable ? { href: card.link } : {};

  return (
    <Tag
      {...tagProps}
      className={cn(
        "group flex overflow-hidden border border-slate-200 bg-white no-underline shadow-sm transition-shadow hover:shadow-md",
        list ? "flex-col sm:flex-row" : "flex-col",
        clickable && "cursor-pointer"
      )}
      style={{ borderRadius: "var(--pc-radius, 16px)" }}
    >
      {card.image && (
        <div
          className={cn(
            "overflow-hidden bg-slate-100",
            list ? "sm:w-56 sm:shrink-0" : "aspect-[16/10] w-full"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.image}
            alt={card.title ?? ""}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
              list && "sm:h-full sm:min-h-[10rem]"
            )}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {card.subtitle && (
          <div
            className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--pc-brand, #6366f1)" }}
          >
            {card.subtitle}
          </div>
        )}
        {card.title && (
          <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
        )}
        {card.text && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">
            {card.text}
          </p>
        )}
      </div>
    </Tag>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <div className="rounded-xl bg-white p-3 text-slate-400 shadow-sm">
        <Database size={20} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
