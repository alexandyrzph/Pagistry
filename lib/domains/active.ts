type DomainLike = { status?: string | null };

export function hasActiveDomain(domains: unknown): boolean {
  return Array.isArray(domains) && domains.some((d) => (d as DomainLike)?.status === "ACTIVE");
}
