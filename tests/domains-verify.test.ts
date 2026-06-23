import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveTxt, resolveCname } = vi.hoisted(() => ({
  resolveTxt: vi.fn(),
  resolveCname: vi.fn(),
}));
vi.mock("dns/promises", () => ({ resolveTxt, resolveCname }));

import { verifyDns } from "@/lib/domains/verify";

beforeEach(() => {
  resolveTxt.mockReset();
  resolveCname.mockReset();
  process.env.PAGISTRY_CNAME_TARGET = "cname.pagistry.com";
});

describe("verifyDns", () => {
  it("ok when the TXT token matches (ownership) regardless of routing", async () => {
    resolveTxt.mockResolvedValue([["pagistry-domain-verification=tok"]]);
    resolveCname.mockRejectedValue(new Error("ENODATA"));
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(true);
    expect(r.ownership).toBe(true);
    expect(r.error).toBeNull();
  });
  it("fails when the TXT token mismatches", async () => {
    resolveTxt.mockResolvedValue([["pagistry-domain-verification=other"]]);
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(false);
    expect(r.ownership).toBe(false);
    expect(r.error).toMatch(/ownership/i);
  });
  it("fails cleanly when the TXT record is missing (ENOTFOUND)", async () => {
    resolveTxt.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    const r = await verifyDns("acme.com", "tok");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ownership/i);
  });
  it("reports routing true when CNAME points at the target", async () => {
    resolveTxt.mockResolvedValue([["pagistry-domain-verification=tok"]]);
    resolveCname.mockResolvedValue(["cname.pagistry.com"]);
    const r = await verifyDns("www.acme.com", "tok");
    expect(r.routing).toBe(true);
  });
});
