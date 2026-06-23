import type { MetadataRoute } from "next";

const BASE = "https://pagistry.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/editor/", "/api/"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
