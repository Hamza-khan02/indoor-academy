/** @type {import('next').NextConfig} */
module.exports = {
  // Lets a test build use its own folder (NEXT_DIST_DIR=.next-test) without touching a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // This folder is the project root (stops Next.js looking at lockfiles in parent folders).
  turbopack: { root: __dirname },
  // Basic browser protections on every page and file the app serves.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Only takes effect on https, i.e. once the app is hosted online.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
    ];
  },
};
