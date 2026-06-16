"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { createLimiter } from "@/lib/thumbnails/queue";

// Shared across all cards: at most 2 screenshot requests in flight at once.
const limiter = createLimiter(2);

export function PageThumbnail({
  pageId,
  title,
  initialUrl,
  version,
  stale,
}: {
  pageId: string;
  title: string;
  initialUrl: string | null;
  version: number | null;
  stale: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [v, setV] = useState(version);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    setLoading(true);
    limiter(() =>
      fetch(`/api/pages/${pageId}/thumbnail`, { method: "POST" }).then((r) =>
        r.ok ? r.json() : null,
      ),
    )
      .then((d: { url?: string; version?: number } | null) => {
        if (d?.url) {
          setUrl(d.url);
          setV(d.version ?? null);
        }
      })
      .catch(() => {
        /* keep last image / placeholder — never break the dashboard */
      })
      .finally(() => setLoading(false));
  }, [stale, pageId]);

  const src = url ? `${url}?v=${v ?? 0}` : null;

  return (
    <div className="absolute inset-0 bg-[#fbfbfc]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#cdd2d8]">
          <FileText size={22} strokeWidth={1.5} />
        </div>
      )}
      {loading && <div className="absolute inset-0 animate-pulse bg-zinc-900/[0.04]" />}
    </div>
  );
}
