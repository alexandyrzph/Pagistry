import { describe, it, expect, beforeEach } from "vitest";
import { normalizeHost, isAppHost, customDomainRewrite, dnsInstructions } from "@/lib/domains/host";

describe("normalizeHost", () => {
  it("lowercases and strips scheme, path, port, and trailing dot", () => {
    expect(normalizeHost("HTTPS://Acme.com:443/about/")).toBe("acme.com");
    expect(normalizeHost("acme.com.")).toBe("acme.com");
    expect(normalizeHost("  WWW.Acme.COM  ")).toBe("www.acme.com");
  });
});

describe("isAppHost", () => {
  beforeEach(() => {
    process.env.APP_PRIMARY_HOST = "pagistry.com";
  });
  it("treats the configured app host (and its www), localhost, and empty as app hosts", () => {
    expect(isAppHost("pagistry.com")).toBe(true);
    expect(isAppHost("www.pagistry.com")).toBe(true);
    expect(isAppHost("localhost:3000")).toBe(true);
    expect(isAppHost("127.0.0.1")).toBe(true);
    expect(isAppHost("")).toBe(true);
  });
  it("treats a customer domain as NOT the app host", () => {
    expect(isAppHost("acme.com")).toBe(false);
    expect(isAppHost("blog.acme.com")).toBe(false);
  });
});

describe("customDomainRewrite", () => {
  it("maps / to the home sentinel and a bare slug under /p", () => {
    expect(customDomainRewrite("/")).toBe("/p/__home__");
    expect(customDomainRewrite("/about")).toBe("/p/about");
  });
  it("passes through api, next internals, assets, and already-prefixed render paths", () => {
    for (const p of [
      "/api/x",
      "/_next/static/x",
      "/c/blog/1",
      "/p/about",
      "/internal/x",
      "/logo.png",
    ]) {
      expect(customDomainRewrite(p)).toBeNull();
    }
  });
  it("rewrites a page slug that merely starts with 'api'", () => {
    expect(customDomainRewrite("/apiguide")).toBe("/p/apiguide");
  });
  it("passes through /store paths unchanged on custom domains", () => {
    expect(customDomainRewrite("/store/tee")).toBeNull();
  });
});

describe("dnsInstructions", () => {
  beforeEach(() => {
    process.env.PAGISTRY_CNAME_TARGET = "cname.pagistry.com";
  });
  it("builds the ownership TXT and a CNAME for a subdomain", () => {
    const i = dnsInstructions("www.acme.com", "tok123");
    expect(i.ownership).toEqual({
      record: "_pagistry-verify.www.acme.com",
      type: "TXT",
      value: "pagistry-domain-verification=tok123",
    });
    expect(i.routing).toEqual({
      record: "www.acme.com",
      type: "CNAME",
      value: "cname.pagistry.com",
    });
  });
  it("uses an A record for an apex domain", () => {
    expect(dnsInstructions("acme.com", "t").routing.type).toBe("A");
  });
});
