import type { Metadata, Viewport } from 'next';
import { Inter, Kalam, Patrick_Hand } from 'next/font/google';
import { Providers } from '@/components/shell/providers';
import { AppShell } from '@/components/shell/app-shell';
import './globals.css';

// Three typefaces, one job each: Kalam for headings and highlight labels,
// Patrick Hand for body text, Inter for navigation, buttons and forms.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });
const kalam = Kalam({ variable: '--font-kalam', subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const patrickHand = Patrick_Hand({ variable: '--font-patrick', subsets: ['latin'], weight: ['400'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'CampusConnect',
    template: '%s · CampusConnect',
  },
  description:
    'Your campus, in one calm app: friends and chats, spaces, videos, games, study tools, events and everyday campus life.',
  applicationName: 'CampusConnect',
  appleWebApp: {
    capable: true,
    title: 'CampusConnect',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#13112a' },
  ],
};

// Runs before first paint so the saved ambience, text size and motion choice never flash.
const ambienceInit = `(function(){try{var s=JSON.parse(localStorage.getItem('cc:v1')||'{}');var t=s.theme||'system';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'night':'day';}var h=document.documentElement;h.dataset.theme=t;h.dataset.mode=(t==='night'||t==='dusk')?'dark':'light';h.dataset.text=s.textSize||'md';h.dataset.motion=s.reduceMotion?'reduce':'full';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${kalam.variable} ${patrickHand.variable} h-full antialiased`}
      data-theme="day"
      data-mode="light"
      data-text="md"
      data-motion="full"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ambienceInit }} />
      </head>
      <body className="min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
