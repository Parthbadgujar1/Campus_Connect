'use client';

// Last-resort error page for a failure in the root layout itself. It renders its own document,
// so it uses plain inline styles and honours the device's light/dark setting.

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong · CampusConnect</title>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: 'Canvas', color: 'CanvasText' }}>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>CampusConnect could not load</h1>
          <p style={{ opacity: 0.75, lineHeight: 1.5 }}>Something went wrong while starting the app. Please try again. If it keeps happening, contact support.</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 16, height: 44, padding: '0 20px', borderRadius: 999, border: 0, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 11, opacity: 0.6, fontFamily: 'ui-monospace, monospace' }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
