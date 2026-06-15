import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/account { name } — update the signed-in user's profile
export async function PATCH(req: Request) {
  const u = await requireApiUser();
  if ("response" in u) return u.response;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string } = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const user = await prisma.user.update({ where: { id: u.user.id }, data });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
