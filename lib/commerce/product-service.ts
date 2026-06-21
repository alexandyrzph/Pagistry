import { minVariantPrice, parseOptions } from "@/lib/commerce/pricing";

export type StoreVariant = {
  id: string;
  title: string;
  options: Record<string, string>;
  priceAmount: number;
  currency: string;
  inventory: number;
  inventoryPolicy: string;
};

export type StoreProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  data: Record<string, string>;
  images: { url: string; alt: string }[];
  variants: StoreVariant[];
  minPrice: { amount: number; currency: string } | null;
};

export type ProductMap = Record<string, StoreProduct>;

type Row = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  data: string;
  images: { url: string; alt: string; position: number }[];
  variants: {
    id: string;
    title: string;
    options: string;
    priceAmount: number;
    currency: string;
    inventory: number;
    inventoryPolicy: string;
  }[];
};

function parseData(s: string): Record<string, string> {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) out[k] = String(val);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildProductMap(rows: Row[]): ProductMap {
  const map: ProductMap = {};
  for (const r of rows) {
    const variants = r.variants.map((v) => ({
      id: v.id,
      title: v.title,
      options: parseOptions(v.options),
      priceAmount: v.priceAmount,
      currency: v.currency,
      inventory: v.inventory,
      inventoryPolicy: v.inventoryPolicy,
    }));
    map[r.id] = {
      id: r.id,
      handle: r.handle,
      title: r.title,
      description: r.description,
      status: r.status,
      data: parseData(r.data),
      images: r.images.map((i) => ({ url: i.url, alt: i.alt })),
      variants,
      minPrice: minVariantPrice(variants),
    };
  }
  return map;
}
