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
    const matchQ =
      !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    const matchF =
      filter === "all" ||
      (filter === "live" && p.published) ||
      (filter === "drafts" && !p.published);
    return matchQ && matchF;
  });
}
