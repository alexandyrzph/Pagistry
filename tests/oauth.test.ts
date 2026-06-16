import { describe, it, expect, afterEach, vi } from "vitest";
import { oauthProviders, buildAuthorizeUrl, normalizeGoogleProfile, normalizeGithubProfile } from "@/lib/auth/oauth";

afterEach(() => vi.unstubAllEnvs());

describe("oauthProviders", () => {
  it("lists only fully-configured providers", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    vi.stubEnv("GITHUB_CLIENT_ID", ""); vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect(oauthProviders()).toEqual(["google"]);
  });
  it("is empty when nothing configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", ""); vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GITHUB_CLIENT_ID", ""); vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect(oauthProviders()).toEqual([]);
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds a Google consent URL with the right params", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsec");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const u = new URL(buildAuthorizeUrl("google", "STATE123"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("gid");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/google/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe("STATE123");
  });
});

describe("profile normalizers", () => {
  it("normalizes a Google userinfo payload", () => {
    expect(normalizeGoogleProfile({ sub: "123", email: "a@b.com", email_verified: true, name: "Ann" }))
      .toEqual({ providerAccountId: "123", email: "a@b.com", emailVerified: true, name: "Ann" });
  });
  it("normalizes GitHub user + picks the primary verified email", () => {
    const user = { id: 42, login: "octo", name: "Octo Cat", email: null };
    const emails = [
      { email: "old@x.com", primary: false, verified: true },
      { email: "octo@x.com", primary: true, verified: true },
    ];
    expect(normalizeGithubProfile(user, emails))
      .toEqual({ providerAccountId: "42", email: "octo@x.com", emailVerified: true, name: "Octo Cat" });
  });
  it("falls back to login when GitHub name is missing and marks unverified email", () => {
    const user = { id: 7, login: "ghost", name: null, email: null };
    const emails = [{ email: "g@x.com", primary: true, verified: false }];
    expect(normalizeGithubProfile(user, emails))
      .toEqual({ providerAccountId: "7", email: "g@x.com", emailVerified: false, name: "ghost" });
  });
});
