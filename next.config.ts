import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Links prefetch each route's shared shell, and what depends on the URL streams in behind its loading.tsx. The next
  // major turns this on for everyone and removes the option.
  partialPrefetching: true,
  reactCompiler: true,
  // Nobody needs to know what it's built with
  poweredByHeader: false,
  // A server of its own, with only what it needs, for the Docker image
  output: 'standalone',
  experimental: {
    // YouTube takes thumbnails of up to 2MB, sent through a server action; the rest is room for the form around it
    serverActions: { bodySizeLimit: '3mb' },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Never inside another site's frame, where it could be dressed up to trick a click (disconnecting a platform). Both: the CSP for browsers now, the other for old ones.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Files are what they say they are, not whatever the browser guesses from their contents
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Other sites learn where a visitor came from, not the page: links like reset-password carry tokens
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
