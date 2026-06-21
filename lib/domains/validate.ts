import { isAppHost, normalizeHost } from "@/lib/domains/host";

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|:/;

export function validateHostname(input: string): { hostname: string } | { error: string } {
  const hostname = normalizeHost(input);
  if (!hostname) return { error: "Enter a domain" };
  if (IP_RE.test(hostname)) return { error: "IP addresses are not allowed" };
  if (isAppHost(hostname)) return { error: "That host is reserved" };
  if (hostname.split(".").length < 2) return { error: "Enter a full domain (e.g. acme.com)" };
  if (!HOSTNAME_RE.test(hostname)) return { error: "That is not a valid domain" };
  return { hostname };
}
