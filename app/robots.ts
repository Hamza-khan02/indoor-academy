import type { MetadataRoute } from 'next';

// Search engines may list the public home page and coach pages. Everything else needs a login,
// so it is kept out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/$', '/home'], disallow: '/' }],
  };
}
