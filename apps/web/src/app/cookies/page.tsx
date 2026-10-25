'use client';

import { LegalPage } from '@/components/legal/legal-page';
import { openCookieSettings, useConsent } from '@/components/shell/cookie-banner';

const STORED: Array<[string, string, string, string]> = [
  ['cc_session', 'Cookie, necessary', 'Keeps you signed in securely. httpOnly: scripts cannot read it.', 'Until you sign out, or up to 30 days with “keep me signed in”'],
  ['cc_csrf', 'Cookie, necessary', 'Protects your account from requests made by other websites.', 'Same as the session'],
  ['cc:consent', 'This device, necessary', 'Remembers your cookie choices so we do not ask again.', 'Until you change them'],
  ['cc:v1', 'This device, necessary', 'Remembers your theme, font and text size before you sign in, and items opened.', 'Until you clear site data'],
];

export default function CookiePolicyPage() {
  const consent = useConsent();
  return (
    <LegalPage
      title="Cookie policy"
      summary={
        <>
          <p><strong className="text-text">In short:</strong> we use only what is strictly necessary to sign you in and keep your account safe. No advertising or third-party tracking cookies.</p>
          <p className="font-sans mt-3 text-[14px]">
            Your current choice: {consent ? `Preferences ${consent.preferences ? 'on' : 'off'}, analytics ${consent.analytics ? 'on' : 'off'}, marketing ${consent.marketing ? 'on' : 'off'}` : 'not chosen yet'}.{' '}
            <button type="button" onClick={openCookieSettings} className="font-semibold text-accent hover:underline">Change cookie settings</button>
          </p>
        </>
      }
      sections={[
        {
          id: 'what',
          title: 'What we store on your device',
          body: (
            <div className="overflow-x-auto">
              <table className="font-sans w-full min-w-[560px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3 font-semibold text-text">Name</th>
                    <th scope="col" className="py-2 pr-3 font-semibold text-text">Type</th>
                    <th scope="col" className="py-2 pr-3 font-semibold text-text">Why</th>
                    <th scope="col" className="py-2 font-semibold text-text">How long</th>
                  </tr>
                </thead>
                <tbody>
                  {STORED.map(([name, type, why, howLong]) => (
                    <tr key={name} className="border-b border-border align-top">
                      <td className="font-mono py-2 pr-3 text-[13px]">{name}</td>
                      <td className="py-2 pr-3">{type}</td>
                      <td className="py-2 pr-3">{why}</td>
                      <td className="py-2">{howLong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        { id: 'optional', title: 'Optional cookies', body: <p>Preferences, analytics and marketing cookies are <strong className="text-text">off by default</strong>. CampusConnect does not currently use any; if we ever add them, they will only run after you switch them on.</p> },
        { id: 'third', title: 'Third parties', body: <p>We do not use advertising networks or social-media trackers. Lecture videos from YouTube use YouTube’s privacy-enhanced mode, which does not set cookies until you press play.</p> },
        { id: 'control', title: 'How to control them', body: <p>Use “Cookie settings” in the footer or in Settings &gt; Privacy. You can also clear cookies in your browser; you will then need to sign in again.</p> },
      ]}
    />
  );
}
