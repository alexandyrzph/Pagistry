import { prisma } from "@/lib/prisma";
import type { OAuthProfile, Provider } from "@/lib/auth/oauth";
import {
  fallbackEmail,
  normalizeOAuthEmail,
  oauthDisplayName,
} from "@/lib/auth/oauth-account.helpers";

/**
 * Resolve an OAuth identity to a user id:
 *  1. existing linked account → that user
 *  2. verified email matching an existing user → link + return
 *  3. otherwise create a new user (null password)
 * Throws "email_in_use" if the (unverified) email already belongs to an account.
 */
export async function linkOrCreateUser(provider: Provider, profile: OAuthProfile): Promise<string> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId },
    },
  });
  if (linked) return linked.userId;

  const email = normalizeOAuthEmail(profile);

  if (email && profile.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await prisma.oAuthAccount.create({
        data: { provider, providerAccountId: profile.providerAccountId, userId: byEmail.id },
      });
      return byEmail.id;
    }
  }

  if (email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new Error("email_in_use"); // unverified provider email — don't take over
  }

  const finalEmail = email || fallbackEmail(provider, profile);
  const user = await prisma.user.create({
    data: { email: finalEmail, name: oauthDisplayName(profile), passwordHash: null },
  });
  await prisma.oAuthAccount.create({
    data: { provider, providerAccountId: profile.providerAccountId, userId: user.id },
  });
  return user.id;
}
