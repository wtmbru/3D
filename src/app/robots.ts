import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/baseUrl";

// Keep private pages (admin, a customer's own order or request, the cart) out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/order/", "/request/", "/checkout", "/cart", "/track"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
