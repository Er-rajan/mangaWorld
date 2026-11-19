import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/format";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/admin"] }, sitemap: `${siteOrigin()}/sitemap.xml` };
}
