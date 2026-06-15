import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireApiUser, verifyPassword, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/account/password { current, next } — change password
export async function POST(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (next.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const row = await prisma.user.findUnique({ where: { id: u.user.id } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: u.user.id }, data: { passwordHash: await hashPassword(next) } });
  // invalidate all OTHER sessions (keep the current one so the user stays signed in)
  const currentToken = (await cookies()).get("pc_session")?.value;
  await prisma.session.deleteMany({
    where: { userId: u.user.id, ...(currentToken ? { NOT: { token: currentToken } } : {}) },
  });
  return NextResponse.json({ ok: true });
}
