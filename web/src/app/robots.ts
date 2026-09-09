import type { MetadataRoute } from "next";
import { siteOrigin } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  const siteUrl = siteOrigin();

  return {
    rules: allowIndexing
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin",
            "/cuenta",
            "/en/admin",
            "/en/cuenta",
            "/api/",
            "/auth/",
          ],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: allowIndexing ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
