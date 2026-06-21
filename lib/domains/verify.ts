import { resolveTxt, resolveCname } from "dns/promises";

export async function verifyDns(
  hostname: string,
  token: string,
): Promise<{ ok: boolean; ownership: boolean; routing: boolean; error: string | null }> {
  const expected = `pagecraft-domain-verification=${token}`;
  let ownership = false;
  try {
    const records = await resolveTxt(`_pagecraft-verify.${hostname}`);
    ownership = records.some((parts) => parts.join("").includes(expected));
  } catch {
    ownership = false;
  }

  let routing = false;
  try {
    const target = (process.env.PAGECRAFT_CNAME_TARGET || "cname.pagecraft.app").toLowerCase();
    const cnames = await resolveCname(hostname);
    routing = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === target);
  } catch {
    routing = false;
  }

  return {
    ok: ownership,
    ownership,
    routing,
    error: ownership ? null : "Ownership TXT record not found or token mismatch",
  };
}
