/**
 * A page's cached thumbnail is stale when it was never taken, or was taken
 * for an older version of the page than the current one.
 *
 * @param takenForUpdatedAt the Page.updatedAt the existing shot reflects (or null/undefined)
 * @param pageUpdatedAt     the page's current updatedAt
 */
export function isThumbnailStale(
  takenForUpdatedAt: Date | string | null | undefined,
  pageUpdatedAt: Date | string,
): boolean {
  if (!takenForUpdatedAt) return true;
  return new Date(takenForUpdatedAt).getTime() < new Date(pageUpdatedAt).getTime();
}
