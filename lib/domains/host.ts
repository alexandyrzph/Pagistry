const LOCAL = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function appHost(): string {
  return normalizeHost(process.env.APP_PRIMARY_HOST || "localhost");
}

export function isAppHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h || LOCAL.has(h)) return true;
  const app = appHost();
  return h === app || h === `www.${app}` || `www.${h}` === app;
}

const PASSTHROUGH = ["/api/", "/_next", "/c/", "/p/", "/internal/", "/store"];

export function customDomainRewrite(pathname: string): string | null {
  if (pathname === "/") return "/p/__home__";
  if (PASSTHROUGH.some((p) => pathname.startsWith(p)) || /\.[a-z0-9]+$/i.test(pathname)) {
    return null;
  }
  return `/p${pathname}`;
}

export function dnsInstructions(hostname: string, token: string) {
  const isApex = hostname.split(".").length <= 2;
  const cnameTarget = process.env.PAGISTRY_CNAME_TARGET || "cname.pagistry.com";
  return {
    ownership: {
      record: `_pagistry-verify.${hostname}`,
      type: "TXT" as const,
      value: `pagistry-domain-verification=${token}`,
    },
    routing: isApex
      ? {
          record: hostname,
          type: "A" as const,
          value: process.env.PAGISTRY_SERVER_IP || "<server-ip>",
        }
      : { record: hostname, type: "CNAME" as const, value: cnameTarget },
  };
}
