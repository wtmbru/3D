/** The shop's public address, for absolute links in previews and the sitemap. Set SITE_URL once there's a custom domain. */
export const baseUrl =
  process.env.SITE_URL?.trim().replace(/\/$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
