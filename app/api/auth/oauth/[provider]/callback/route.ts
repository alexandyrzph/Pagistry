import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isProvider, oauthProviders, exchangeCode, fetchProfile } from "@/lib/auth/oauth";
import { verifyState } from "@/lib/auth/oauth-state";
import { linkOrCreateUser } from "@/lib/auth/oauth-account";
import { createSession } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (url.searchParams.get("error")) return to("/login?error=oauth_denied");
  if (!isProvider(provider) || !oauthProviders().includes(provider)) return to("/login?error=provider_unavailable");

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const jar = await cookies();
  const cookieState = jar.get("pc_oauth_state")?.value;
  jar.delete("pc_oauth_state");

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) return to("/login?error=oauth_state");
  const decoded = verifyState(stateParam);
  if (!decoded) return to("/login?error=oauth_state");

  try {
    const token = await exchangeCode(provider, code);
    const profile = await fetchProfile(provider, token);
    const userId = await linkOrCreateUser(provider, profile);
    await createSession(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const safeNext = decoded.next && decoded.next.startsWith("/") && !decoded.next.startsWith("//") ? decoded.next : "/";
    return to(user?.onboardedAt ? safeNext : "/onboarding");
  } catch (e) {
    const reason = e instanceof Error && e.message === "email_in_use" ? "email_in_use" : "oauth_failed";
    console.error("[oauth] callback failed", provider, e);
    return to(`/login?error=${reason}`);
  }
}
