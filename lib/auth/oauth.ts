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
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    idEnv: "GITHUB_CLIENT_ID",
    secretEnv: "GITHUB_CLIENT_SECRET",
  },
};

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function redirectUri(provider: Provider): string {
  return `${appUrl()}/api/auth/oauth/${provider}/callback`;
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

export function normalizeGoogleProfile(raw: any): OAuthProfile {
  return {
    providerAccountId: String(raw.sub),
    email: raw.email ?? null,
    emailVerified: raw.email_verified === true || raw.email_verified === "true",
    name: raw.name || raw.email || "",
  };
}

export function normalizeGithubProfile(
  user: any,
  emails: Array<{ email: string; primary: boolean; verified: boolean }>,
): OAuthProfile {
  const primary = emails.find((e) => e.primary) || emails[0];
  return {
    providerAccountId: String(user.id),
    email: primary?.email ?? user.email ?? null,
    emailVerified: !!primary?.verified,
    name: user.name || user.login || "",
  };
}

// --- network helpers (not unit-tested; exercised in the manual checklist) ---

export async function exchangeCode(provider: Provider, code: string): Promise<string> {
  const cfg = CONFIG[provider];
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: process.env[cfg.idEnv] || "",
      client_secret: process.env[cfg.secretEnv] || "",
      code,
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`token exchange failed: ${res.status}`);
  return data.access_token as string;
}

export async function fetchProfile(provider: Provider, accessToken: string): Promise<OAuthProfile> {
  const headers = { authorization: `Bearer ${accessToken}`, accept: "application/json", "user-agent": "pagecraft" };
  if (provider === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers });
    if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
    return normalizeGoogleProfile(await res.json());
  }
  const [uRes, eRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  if (!uRes.ok) throw new Error(`github user failed: ${uRes.status}`);
  const user = await uRes.json();
  const emails = eRes.ok ? await eRes.json() : [];
  return normalizeGithubProfile(user, Array.isArray(emails) ? emails : []);
}
