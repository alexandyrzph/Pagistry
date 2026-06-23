import { resolveTxt, resolveCname } from "dns/promises";

export async function verifyDns(
  hostname: string,
  token: string,
): Promise<{ ok: boolean; ownership: boolean; routing: boolean; error: string | null }> {
  const expected = `pagistry-domain-verification=${token}`;
  let ownership = false;
  try {
    const records = await resolveTxt(`_pagistry-verify.${hostname}`);
    ownership = records.some((parts) => parts.join("").trim() === expected);
  } catch {
    ownership = false;
  }

  let routing = false;
  try {
    const target = (process.env.PAGISTRY_CNAME_TARGET || "cname.pagistry.com").toLowerCase();
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
