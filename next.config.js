/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'maps.gstatic.com' },
      { protocol: 'https', hostname: '**.yandex.net' },
      { protocol: 'https', hostname: 'avatars.mds.yandex.net' },
      { protocol: 'https', hostname: '**.2gis.ru' },
      { protocol: 'https', hostname: '2gis.ru' },
      { protocol: 'https', hostname: '**.2gis.com' },
    ],
    // Оптимизация изображений
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 часа кэш
  },
  env: {
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
}

module.exports = nextConfig

