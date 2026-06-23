import axios from "axios";
import { externalApi, endpoints } from "@/lib/api/endpoints";

export type Provider = "google" | "github";

export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
};

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  idEnv: string;
  secretEnv: string;
};

const CONFIG: Record<Provider, ProviderConfig> = {
  google: {
    authorizeUrl: externalApi.oauth.google.authorize,
    tokenUrl: externalApi.oauth.google.token,
    scope: "openid email profile",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: externalApi.oauth.github.authorize,
    tokenUrl: externalApi.oauth.github.token,
    scope: "read:user user:email",
    idEnv: "GITHUB_CLIENT_ID",
    secretEnv: "GITHUB_CLIENT_SECRET",
  },
};

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function redirectUri(provider: Provider): string {
  return `${appUrl()}${endpoints.auth.oauthCallback(provider)}`;
}

export function isProvider(p: string): p is Provider {
  return p === "google" || p === "github";
}

export function oauthProviders(): Provider[] {
  return (Object.keys(CONFIG) as Provider[]).filter(
    (p) => !!process.env[CONFIG[p].idEnv] && !!process.env[CONFIG[p].secretEnv],
  );
}

export function buildAuthorizeUrl(provider: Provider, state: string): string {
  const cfg = CONFIG[provider];
  const params = new URLSearchParams({
    client_id: process.env[cfg.idEnv] || "",
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (provider === "google") params.set("prompt", "select_account");
  if (provider === "github") params.set("allow_signup", "true");
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export function normalizeGoogleProfile(raw: unknown): OAuthProfile {
  const r = (raw ?? {}) as {
    sub?: string | number | null;
    email?: string | null;
    email_verified?: boolean | string;
    name?: string | null;
  };
  return {
    providerAccountId: String(r.sub),
    email: r.email ?? null,
    emailVerified: r.email_verified === true || r.email_verified === "true",
    name: r.name || r.email || "",
  };
}

export function normalizeGithubProfile(
  user: unknown,
  emails: Array<{ email: string; primary: boolean; verified: boolean }>,
): OAuthProfile {
  const u = (user ?? {}) as {
    id?: string | number | null;
    email?: string | null;
    name?: string | null;
    login?: string | null;
  };
  const primary = emails.find((e) => e.primary) || emails[0];
  return {
    providerAccountId: String(u.id),
    email: primary?.email ?? u.email ?? null,
    emailVerified: !!primary?.verified,
    name: u.name || u.login || "",
  };
}

// --- network helpers ---

export async function exchangeCode(provider: Provider, code: string): Promise<string> {
  const cfg = CONFIG[provider];
  try {
    const { data } = await axios.post(
      cfg.tokenUrl,
      new URLSearchParams({
        client_id: process.env[cfg.idEnv] || "",
        client_secret: process.env[cfg.secretEnv] || "",
        code,
        redirect_uri: redirectUri(provider),
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
      },
    );
    if (!data.access_token) throw new Error("token exchange failed: no access_token");
    return data.access_token as string;
  } catch (e) {
    if (axios.isAxiosError(e))
      throw new Error(`token exchange failed: ${e.response?.status ?? "network"}`);
    throw e;
  }
}

export async function fetchProfile(provider: Provider, accessToken: string): Promise<OAuthProfile> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "user-agent": "pagistry",
  };
  if (provider === "google") {
    try {
      const { data } = await axios.get(externalApi.oauth.google.userInfo, { headers });
      return normalizeGoogleProfile(data);
    } catch (e) {
      if (axios.isAxiosError(e))
        throw new Error(`google userinfo failed: ${e.response?.status ?? "network"}`);
      throw e;
    }
  }
  const [uRes, eRes] = await Promise.allSettled([
    axios.get(externalApi.oauth.github.user, { headers }),
    axios.get(externalApi.oauth.github.emails, { headers }),
  ]);
  if (uRes.status === "rejected") throw new Error("github user failed");
  const user = uRes.value.data;
  const emails =
    eRes.status === "fulfilled" && Array.isArray(eRes.value.data) ? eRes.value.data : [];
  return normalizeGithubProfile(user, emails);
}
