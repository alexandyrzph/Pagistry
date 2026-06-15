import type { MetadataRoute } from "next";

const BASE = "https://pagecraft.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/editor/", "/api/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
