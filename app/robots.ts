import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/project/', '/admin'] },
    sitemap: 'https://nowmywork.com/sitemap.xml',
  };
}
