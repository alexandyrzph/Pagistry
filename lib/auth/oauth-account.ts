import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/lib/auth/workspace";
import type { OAuthProfile, Provider } from "@/lib/auth/oauth";

/**
 * Resolve an OAuth identity to a user id:
 *  1. existing linked account → that user
 *  2. verified email matching an existing user → link + return
 *  3. otherwise create a new user (null password) + auto-create their workspace
 * Throws "email_in_use" if the (unverified) email already belongs to an account.
 */
export async function linkOrCreateUser(provider: Provider, profile: OAuthProfile): Promise<string> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
  });
  if (linked) return linked.userId;

  const email = profile.email ? profile.email.toLowerCase() : null;

  if (email && profile.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await prisma.oAuthAccount.create({ data: { provider, providerAccountId: profile.providerAccountId, userId: byEmail.id } });
      return byEmail.id;
    }
  }

  if (email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new Error("email_in_use"); // unverified provider email — don't take over
  }

  const finalEmail = email || `${provider}-${profile.providerAccountId}@users.noreply.pagecraft.local`;
  const user = await prisma.user.create({ data: { email: finalEmail, name: profile.name || "", passwordHash: null } });
  await prisma.oAuthAccount.create({ data: { provider, providerAccountId: profile.providerAccountId, userId: user.id } });
  await createWorkspace(user.id, `${(profile.name || "My").trim() || "My"}'s Workspace`);
  return user.id;
}
