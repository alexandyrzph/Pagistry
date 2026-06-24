export type DashboardFilter = "all" | "live" | "drafts";

type FilterablePage = { title: string; slug: string; published: boolean };

/** Filter pages by a search query (title or slug, case-insensitive) and a
 *  status filter (all | live | drafts). Pure — safe to unit test. */
export function filterPages<T extends FilterablePage>(
  pages: T[],
  query: string,
  filter: DashboardFilter,
): T[] {
  const q = query.trim().toLowerCase();
  return pages.filter((p) => {
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    const matchF =
      filter === "all" ||
      (filter === "live" && p.published) ||
      (filter === "drafts" && !p.published);
    return matchQ && matchF;
  });
}

/** Heading for the dashboard empty state: a search-aware message when the user
 *  is searching, otherwise a status-filter-aware one. Pure. */
export function emptyStateMessage(query: string, filter: DashboardFilter): string {
  if (query.trim()) return `No pages match “${query}”`;
  if (filter === "live") return "No live pages yet";
  if (filter === "drafts") return "No drafts yet";
  return "No pages yet";
}
