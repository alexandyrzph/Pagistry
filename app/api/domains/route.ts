import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, created, badRequest, error } from "@/lib/api/api-response";
import { validateHostname } from "@/lib/domains/validate";
import { dnsInstructions } from "@/lib/domains/host";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const domains = await prisma.domain.findMany({
      where: { siteId: ctx.site.id },
      orderBy: { createdAt: "asc" },
    });
    return json(domains);
  });
}

export async function POST(req: Request) {
  return withSiteRole("ADMIN", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const result = validateHostname(String(body?.hostname ?? ""));
    if ("error" in result) return badRequest(result.error);
    const existing = await prisma.domain.findUnique({ where: { hostname: result.hostname } });
    if (existing) return error(409, "That domain is already in use");
    const domain = await prisma.domain.create({
      data: { siteId: ctx.site.id, hostname: result.hostname },
    });
    return created({ domain, dns: dnsInstructions(domain.hostname, domain.verificationToken) });
  });
}
