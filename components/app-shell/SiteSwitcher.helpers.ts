export type SiteOption = { id: string; name: string; handle: string };

export function siteInitial(name?: string): string {
  const t = (name ?? "").trim();
  return t ? t.charAt(0).toUpperCase() : "S";
}
