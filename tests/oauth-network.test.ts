import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import axios from "axios";
import { exchangeCode, fetchProfile } from "@/lib/auth/oauth";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: vi.fn(() => false),
  },
}));

const post = axios.post as unknown as Mock;
const get = axios.get as unknown as Mock;
const isAxiosError = axios.isAxiosError as unknown as Mock;

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  isAxiosError.mockReset();
  isAxiosError.mockReturnValue(false);
});

describe("exchangeCode", () => {
  it("returns the access_token on success", async () => {
    post.mockResolvedValue({ data: { access_token: "tok-123" } });
    await expect(exchangeCode("google", "code")).resolves.toBe("tok-123");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("throws when no access_token is returned", async () => {
    post.mockResolvedValue({ data: {} });
    await expect(exchangeCode("github", "code")).rejects.toThrow(/no access_token/);
  });

  it("wraps an axios error with its status", async () => {
    isAxiosError.mockReturnValue(true);
    post.mockRejectedValue({ response: { status: 400 } });
    await expect(exchangeCode("google", "bad")).rejects.toThrow(/token exchange failed: 400/);
  });
});

describe("fetchProfile", () => {
  it("normalizes a Google profile", async () => {
    get.mockResolvedValue({
      data: { sub: 42, email: "a@b.com", email_verified: true, name: "Ada" },
    });
    const p = await fetchProfile("google", "tok");
    expect(p).toEqual({
      providerAccountId: "42",
      email: "a@b.com",
      emailVerified: true,
      name: "Ada",
    });
  });

  it("wraps a Google userinfo axios error", async () => {
    isAxiosError.mockReturnValue(true);
    get.mockRejectedValue({ response: { status: 401 } });
    await expect(fetchProfile("google", "tok")).rejects.toThrow(/google userinfo failed: 401/);
  });

  it("merges a GitHub profile with its primary verified email", async () => {
    get
      .mockResolvedValueOnce({ data: { id: 7, login: "octocat", name: "Octo" } })
      .mockResolvedValueOnce({
        data: [
          { email: "secondary@x.com", primary: false, verified: false },
          { email: "octo@x.com", primary: true, verified: true },
        ],
      });
    const p = await fetchProfile("github", "tok");
    expect(p).toEqual({
      providerAccountId: "7",
      email: "octo@x.com",
      emailVerified: true,
      name: "Octo",
    });
  });

  it("throws when the GitHub user request fails", async () => {
    get.mockRejectedValue(new Error("boom"));
    await expect(fetchProfile("github", "tok")).rejects.toThrow(/github user failed/);
  });
});
