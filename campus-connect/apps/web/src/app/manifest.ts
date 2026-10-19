import type { MetadataRoute } from 'next';

// Makes the web portal installable on a phone home screen and launch full-screen,
// so students get an app-like experience before a native build exists.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CampusConnect',
    short_name: 'CampusConnect',
    description: 'Your campus, in one app.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f5ed',
    theme_color: '#302675',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
