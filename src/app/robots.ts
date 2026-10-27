import type { MetadataRoute } from 'next';

/** Stream is for its one account, so there's nothing in it for crawlers. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
