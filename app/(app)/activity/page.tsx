"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";

type ActivityEvent = {
  id: string;
  type: string;
  targetId: string | null;
  meta: Record<string, unknown>;
  actor: string;
  createdAt: string;
};

function verbForType(type: string): string {
  switch (type) {
    case "page.created":
      return "created a page";
    case "page.published":
      return "published a page";
    case "invite.sent":
      return "invited someone";
    case "member.joined":
      return "joined the workspace";
    default:
      return type;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function groupByDay(events: ActivityEvent[]): { day: string; items: ActivityEvent[] }[] {
  const groups: { day: string; items: ActivityEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === label) {
      last.items.push(e);
    } else {
      groups.push({ day: label, items: [e] });
    }
  }
  return groups;
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setEvents(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10 lg:px-12">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Activity</h1>
      <p className="mt-1 text-sm text-zinc-500">A log of everything your team has done in this workspace.</p>

      <div className="mt-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <Activity size={24} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">Activity will appear here as your team builds.</p>
            <p className="text-xs text-zinc-400">Create or publish a page to see your first event.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupByDay(events).map(({ day, items }) => (
              <div key={day}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{day}</p>
                <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
                  {items.map((e) => (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {(e.actor || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-zinc-800">{e.actor}</span>
                        <span className="text-sm text-zinc-500"> {verbForType(e.type)}</span>
                        {typeof e.meta === "object" && e.meta !== null && "title" in e.meta && (
                          <span className="text-sm text-zinc-500"> — <span className="text-zinc-700">{String(e.meta.title)}</span></span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400">{relativeTime(e.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
