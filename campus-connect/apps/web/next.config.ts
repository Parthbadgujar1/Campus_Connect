import type { NextConfig } from 'next';

// The web app is a mobile-first React front end that runs on mock data.
// No backend is part of the repo during the UI/UX phase.
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
