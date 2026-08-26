import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: allowIndexing
      ? { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: allowIndexing ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
