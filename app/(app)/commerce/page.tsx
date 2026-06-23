import { prisma } from "@/lib/prisma";
import { requireSite } from "@/lib/auth/site";
import { StoreAdmin } from "@/components/store/StoreAdmin";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const ctx = await requireSite();
  const store = await prisma.store.findUnique({ where: { siteId: ctx.site.id } });
  const products = await prisma.product.findMany({
    where: { siteId: ctx.site.id },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <StoreAdmin initialStore={store} initialProducts={JSON.parse(JSON.stringify(products))} />;
}
