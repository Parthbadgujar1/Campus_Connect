'use client';

import Link from 'next/link';
import { DataRequestForm } from '@/components/legal/data-request-form';
import { LegalPage, OperatorDetails } from '@/components/legal/legal-page';

// Plain-language privacy policy, written for India's Digital Personal Data Protection Act 2023
// and GDPR-style good practice. Operator details come from the server configuration
// (OPERATOR_NAME, OPERATOR_ADDRESS, SUPPORT_EMAIL, PRIVACY_EMAIL) and must be filled in before
// launch.

const RETENTION: Array<[string, string]> = [
  ['Your account and profile', 'Until you delete your account (then 30 days to change your mind)'],
  ['Posts, comments, messages and files', 'Until you or the moderators delete them, or you delete your account'],
  ['Notifications', '180 days'],
  ['Sign-in history (for security)', '30 days'],
  ['Unverified sign-ups', '14 days'],
  ['Data export files', '7 days after they are ready'],
  ['Email delivery records', '90 days (the email text itself, 14 days)'],
  ['Security audit log (anonymous ids only)', '180 days online, longer only if the law requires'],
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      summary={
        <>
          <p><strong className="text-text">In short:</strong> we collect only what CampusConnect needs to work, we never sell your data, there are no ads and no tracking cookies, and you can download or delete everything at any time.</p>
        </>
      }
      sections={[
        { id: 'who', title: 'Who we are', body: <><p>CampusConnect is operated by:</p><p><OperatorDetails /></p><p>We are the “data fiduciary” for the personal data described here.</p></> },
        {
          id: 'collect',
          title: 'What we collect',
          body: (
            <>
              <ul className="list-disc space-y-1.5 pl-6">
                <li><strong className="text-text">Account:</strong> your name, email address and the role details you give at sign-up (enrolment or employee number, designation, organisation), and a scrambled form of your password (we never see or store the password itself).</li>
                <li><strong className="text-text">Profile (optional):</strong> photo, headline, bio, department, year, semester, division, skills, interests and links, only if you add them.</li>
                <li><strong className="text-text">What you share:</strong> posts, comments, messages, files, events, listings and other content you create.</li>
                <li><strong className="text-text">Settings:</strong> theme, font, notification choices, and your cookie and consent choices.</li>
                <li><strong className="text-text">Security data:</strong> your signed-in devices (for example “Chrome on Windows”) and sign-in attempts. Network addresses are stored only in a scrambled (hashed) form.</li>
              </ul>
              <p><strong className="text-text">We do not collect</strong> your contacts, precise location, advertising IDs or browsing outside CampusConnect, and we do not use third-party trackers.</p>
            </>
          ),
        },
        {
          id: 'why',
          title: 'Why we use it',
          body: (
            <ul className="list-disc space-y-1.5 pl-6">
              <li>To run your account and show you the content on CampusConnect (the service you asked for).</li>
              <li>To keep everyone safe: preventing spam, fraud and abuse, and handling reports.</li>
              <li>To send emails you need (verification, password resets, security alerts) and, only if you opt in, summaries and product news.</li>
              <li>To meet legal duties, such as responding to lawful requests.</li>
            </ul>
          ),
        },
        {
          id: 'anonymous',
          title: 'Anonymous posts and Hush',
          body: (
            <>
              <p>When you post anonymously, your name is not stored on the post. It is kept separately so you can manage your own posts and so we can enforce rules. Other students, space owners and even moderators cannot see it.</p>
              <p>Revealing who wrote anonymous content is possible only for serious safety or legal reasons, needs a request by one admin and approval by a different admin, and every step is permanently logged.</p>
            </>
          ),
        },
        {
          id: 'visibility',
          title: 'Who can see your information',
          body: (
            <>
              <p>Your profile and posts can be seen by other people on CampusConnect. You can post to everyone or to a space, and in <Link href="/settings/privacy" className="text-accent hover:underline">privacy controls</Link> you choose who can see your profile details and who can message you.</p>
              <p>Blocking someone hides you from each other everywhere.</p>
            </>
          ),
        },
        {
          id: 'sharing',
          title: 'Sharing',
          body: (
            <>
              <p><strong className="text-text">We never sell or rent your data</strong>, and we do not share it for advertising.</p>
              <p>We use a small number of service providers to run CampusConnect (hosting, file storage and email delivery). They process data only on our instructions and must protect it. We may disclose data when the law requires it, and we push back on requests that are not lawful.</p>
            </>
          ),
        },
        {
          id: 'security',
          title: 'How we protect it',
          body: (
            <ul className="list-disc space-y-1.5 pl-6">
              <li>Encrypted connections (HTTPS) everywhere.</li>
              <li>Passwords hashed with Argon2id; sign-in tokens stored only as hashes.</li>
              <li>Uploads checked by their real file type, photo location data removed, and files served through short-lived private links.</li>
              <li>Limits on sign-in attempts, alerts for sign-ins from new devices, and an audit log of admin actions.</li>
            </ul>
          ),
        },
        {
          id: 'retention',
          title: 'How long we keep it',
          body: (
            <div className="overflow-x-auto">
              <table className="font-sans w-full min-w-[480px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b border-border"><th scope="col" className="py-2 pr-4 font-semibold text-text">Data</th><th scope="col" className="py-2 font-semibold text-text">Kept for</th></tr>
                </thead>
                <tbody>
                  {RETENTION.map(([d, k]) => (
                    <tr key={d} className="border-b border-border"><td className="py-2 pr-4">{d}</td><td className="py-2">{k}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: 'your-rights',
          title: 'Your rights and choices',
          body: (
            <>
              <ul className="list-disc space-y-1.5 pl-6">
                <li><strong className="text-text">See and download</strong> your data: Settings &gt; Your data &amp; account &gt; Request a copy.</li>
                <li><strong className="text-text">Correct</strong> it: edit your profile any time.</li>
                <li><strong className="text-text">Delete</strong> your account: Settings &gt; Your data &amp; account. Your profile is hidden at once and everything is permanently deleted after 30 days.</li>
                <li><strong className="text-text">Withdraw consent</strong> for optional emails and cookies at any time; it never affects the rest of the service.</li>
                <li><strong className="text-text">Complain</strong> to our Grievance Officer (below), and if you are not satisfied, to the Data Protection Board of India.</li>
              </ul>
              <p>Can’t sign in? Ask here, and confirm from your inbox:</p>
              <DataRequestForm />
            </>
          ),
        },
        { id: 'age', title: 'Age', body: <p>CampusConnect is for people aged 18 and over. We do not knowingly collect data from children. If you think a child has an account, <Link href="/contact?topic=safety" className="text-accent hover:underline">tell us</Link> and we will remove it.</p> },
        { id: 'changes', title: 'Changes to this policy', body: <p>If we make important changes, we will tell you in the app and by email before they take effect. The date at the top always shows the latest version.</p> },
        { id: 'contact', title: 'Contact and Grievance Officer', body: <p><OperatorDetails /> We reply within 7 days, and resolve complaints within 30 days.</p> },
      ]}
    />
  );
}
