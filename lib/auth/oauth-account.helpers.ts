import type { OAuthProfile, Provider } from "@/lib/auth/oauth";

export function normalizeOAuthEmail(profile: OAuthProfile): string | null {
  return profile.email ? profile.email.toLowerCase() : null;
}

export function fallbackEmail(provider: Provider, profile: OAuthProfile): string {
  return `${provider}-${profile.providerAccountId}@users.noreply.pagistry.local`;
}

export function oauthDisplayName(profile: OAuthProfile): string {
  return profile.name || "";
}

export function oauthWorkspaceName(profile: OAuthProfile): string {
  return `${(profile.name || "My").trim() || "My"}'s Workspace`;
}
