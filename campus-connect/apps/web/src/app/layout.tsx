import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Kalam } from 'next/font/google';
import { Providers } from '@/components/shell/providers';
import { AppShell } from '@/components/shell/app-shell';
import './globals.css';

// One typeface for the whole app: Kalam, for titles, text, buttons and forms.
const kalam = Kalam({ variable: '--font-kalam', subsets: ['latin'], weight: ['300', '400', '700'], display: 'swap' });
// Offered in Appearance as "Easy to read": designed for low vision and dyslexia. Loaded lazily
// (preload off) because most people keep the default look.
const atkinson = Atkinson_Hyperlegible({ variable: '--font-atkinson', subsets: ['latin'], weight: ['400', '700'], display: 'swap', preload: false });

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

// Runs before first paint so the saved ambience, font, text size and motion choice never flash.
const ambienceInit = `(function(){try{var s=JSON.parse(localStorage.getItem('cc:v1')||'{}');var t=s.theme||'system';if(t==='dusk'){t='night';}if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'night':'day';}var h=document.documentElement;h.dataset.theme=t;h.dataset.mode=t==='night'?'dark':'light';h.dataset.text=s.textSize||'md';h.dataset.font=s.font&&s.font!=='classic'?s.font:'handwritten';h.dataset.motion=s.reduceMotion?'reduce':'full';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${kalam.variable} ${atkinson.variable} h-full antialiased`}
      data-theme="day"
      data-mode="light"
      data-text="md"
      data-font="handwritten"
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
