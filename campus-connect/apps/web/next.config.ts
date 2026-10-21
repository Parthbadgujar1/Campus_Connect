import type { NextConfig } from 'next';

// The web app talks to the CampusConnect API through a same-origin proxy: the browser calls
// /api/v1/..., and Next forwards it to the API. Session cookies therefore stay first-party
// (no third-party cookie problems, no CORS preflights), and the API address is never exposed.
const API_ORIGIN = (process.env.API_ORIGIN ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

// Security headers for every page. (The API sets its own, stricter headers on API responses.)
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // A second local dev server (for example a preview on another port) needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // The extra preview server skips Turbopack's on-disk cache so it does not use disk space
    // (it compiles a little slower after a restart). The main dev server keeps the default.
    turbopackFileSystemCacheForDev: !process.env.NEXT_DIST_DIR,
  },
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/:path*` }];
  },
  // Early concept screens that never had a backend now point at the real feature.
  async redirects() {
    return [
      { source: '/help', destination: '/hush', permanent: false },
      { source: '/settings/details', destination: '/profile/edit', permanent: false },
      { source: '/admin/students', destination: '/admin/people', permanent: false },
      { source: '/admin/announcements', destination: '/news', permanent: false },
      { source: '/admin/lectures', destination: '/lectures', permanent: false },
      { source: '/academics', destination: '/resources', permanent: false },
      { source: '/achievements', destination: '/you', permanent: false },
      { source: '/creators', destination: '/discover', permanent: false },
      { source: '/network', destination: '/connect', permanent: false },
      { source: '/watch/:path*', destination: '/loops', permanent: false },
      { source: '/travel/:path*', destination: '/marketplace', permanent: false },
      { source: '/offers', destination: '/marketplace', permanent: false },
      { source: '/business', destination: '/services', permanent: false },
      { source: '/finance', destination: '/campus', permanent: false },
      { source: '/study/rooms/:path*', destination: '/study', permanent: false },
      { source: '/study/flashcards', destination: '/study', permanent: false },
      { source: '/housing/:id', destination: '/marketplace/:id', permanent: false },
      { source: '/teams/:id', destination: '/teams', permanent: false },
      { source: '/spaces/:slug/c/:channel', destination: '/spaces/:slug', permanent: false },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
