import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://nowmywork.com';
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/signin`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/signup`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
