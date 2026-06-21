import { describe, it, expect, beforeEach } from "vitest";
import { validateHostname } from "@/lib/domains/validate";

describe("validateHostname", () => {
  beforeEach(() => {
    process.env.APP_PRIMARY_HOST = "pagecraft.app";
  });
  it("accepts a normal domain and a subdomain (normalized)", () => {
    expect(validateHostname("Acme.com")).toEqual({ hostname: "acme.com" });
    expect(validateHostname("blog.acme.com")).toEqual({ hostname: "blog.acme.com" });
  });
  it("rejects empty, IPs, the app host, localhost, single-label, and malformed input", () => {
    expect("error" in validateHostname("")).toBe(true);
    expect("error" in validateHostname("127.0.0.1")).toBe(true);
    expect("error" in validateHostname("pagecraft.app")).toBe(true);
    expect("error" in validateHostname("localhost")).toBe(true);
    expect("error" in validateHostname("nodot")).toBe(true);
    expect("error" in validateHostname("bad host.com")).toBe(true);
    expect("error" in validateHostname("a".repeat(254) + ".com")).toBe(true);
  });
});
