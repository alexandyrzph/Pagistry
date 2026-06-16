import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const r = await requireApiUser();
  if ("response" in r) return r.response;
  await prisma.user.update({ where: { id: r.user.id }, data: { onboardedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
