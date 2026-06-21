import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hostname = normalizeHost(new URL(req.url).searchParams.get("domain") ?? "");
  if (!hostname) return new Response(null, { status: 403 });
  const domain = await prisma.domain.findUnique({ where: { hostname } });
  return new Response(null, { status: domain?.status === "ACTIVE" ? 200 : 403 });
}
