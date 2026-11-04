import type { MetadataRoute } from "next";

/** Private app — block all crawlers (Google, Bing, etc.). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
