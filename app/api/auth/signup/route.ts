import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");

  if (!emailRe.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  // Give every new user their own workspace (per-team tenancy backbone).
  await createWorkspace(user.id, `${(name || "My").trim() || "My"}'s Workspace`);
  return NextResponse.json({ ok: true, onboarded: false });
}
