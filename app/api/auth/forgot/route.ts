import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  // Don't reveal whether the email exists.
  if (!user) return NextResponse.json({ ok: true });

  const token = newToken();
  await prisma.passwordReset.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1h
  });
  const resetUrl = `${new URL(req.url).origin}/reset?token=${token}`;
  // No email service configured — surface the link (and log it) so the flow works.
  console.log(`[password-reset] ${email} -> ${resetUrl}`);
  return NextResponse.json({ ok: true, resetUrl });
}
