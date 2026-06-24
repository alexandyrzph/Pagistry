import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isProvider, oauthProviders, buildAuthorizeUrl, appUrl } from "@/lib/auth/oauth";
import { signState } from "@/lib/auth/oauth-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const next = new URL(req.url).searchParams.get("next") || "";
  if (!isProvider(provider) || !oauthProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/login?error=provider_unavailable", appUrl()));
  }
  const state = signState({ next });
  const jar = await cookies();
  jar.set("pc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthorizeUrl(provider, state));
}
