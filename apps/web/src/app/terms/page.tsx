'use client';

import Link from 'next/link';
import { LegalPage, OperatorDetails } from '@/components/legal/legal-page';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      summary={
        <p>
          <strong className="text-text">In short:</strong> CampusConnect is free for students, with no hidden fees and no ads. Be kind, be honest, respect people’s privacy, and do not
          use it for anything illegal. You own what you post; you give us permission to show it to the people you chose.
        </p>
      }
      sections={[
        { id: 'who', title: 'Who these terms are with', body: <p>These terms are an agreement between you and <OperatorDetails /></p> },
        {
          id: 'eligibility',
          title: 'Who can use CampusConnect',
          body: (
            <ul className="list-disc space-y-1.5 pl-6">
              <li>You must be 18 or older.</li>
              <li>You sign up with your own email address and your real name, and only one account per person.</li>
              <li>Faculty and industry-expert roles are given after a review by your college’s admins.</li>
            </ul>
          ),
        },
        { id: 'account', title: 'Your account', body: <p>Keep your password private and use one you do not use elsewhere. You are responsible for what happens on your account. Tell us right away if you think someone else has used it; you can sign out every device from Settings &gt; Password &amp; devices.</p> },
        {
          id: 'conduct',
          title: 'Community rules',
          body: (
            <>
              <p>Do not:</p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li>harass, bully, threaten or shame anyone, or post hate based on caste, religion, gender, region, disability or anything else;</li>
                <li>share someone’s private information or photos without their consent;</li>
                <li>post sexual content, violence, or anything that encourages self-harm;</li>
                <li>scam, spam, impersonate others, sell exam papers, or post fake notices;</li>
                <li>upload content you do not have the right to share (for example whole textbooks);</li>
                <li>try to break, overload or get around the security of CampusConnect.</li>
              </ul>
              <p>Anonymous posting is for honest questions, not for attacking people. Anonymous content follows the same rules.</p>
            </>
          ),
        },
        { id: 'content', title: 'Your content', body: <><p>You keep ownership of what you post. You give CampusConnect a limited licence to store it and show it to the audience you chose, only to run the service. When you delete it, we stop showing it.</p><p>Shelf uploads by students are reviewed by faculty before they are published.</p></> },
        { id: 'marketplace', title: 'Marketplace, lost & found and meetups', body: <p>CampusConnect does not handle payments and takes no commission. Deals are between students: meet in public places on campus, check items before paying, and never share OTPs or bank details. We are not responsible for items exchanged, but please report anything suspicious.</p> },
        { id: 'moderation', title: 'Moderation', body: <p>Moderators may hide or remove content and suspend accounts that break these rules. Content reported by several people is hidden until reviewed. If you think a decision was wrong, <Link href="/contact?topic=support" className="text-accent hover:underline">contact us</Link> and a person will look again.</p> },
        { id: 'fees', title: 'Fees', body: <p>CampusConnect is free. There are no hidden fees, subscriptions or in-app purchases. If that ever changes, we will tell you clearly in advance and nothing will be charged without your explicit agreement.</p> },
        { id: 'availability', title: 'Availability and changes', body: <p>We work hard to keep CampusConnect running, but it may sometimes be unavailable for maintenance or reasons outside our control. We may add, change or remove features; we will give notice of important changes.</p> },
        { id: 'liability', title: 'Responsibility', body: <p>CampusConnect is provided “as is”. To the extent the law allows, we are not liable for indirect losses or for content posted by other people. Nothing in these terms limits rights you have under Indian consumer law.</p> },
        { id: 'ending', title: 'Leaving or being removed', body: <p>You can delete your account at any time from Settings &gt; Your data &amp; account. We may suspend or close accounts that seriously or repeatedly break these terms, and we will explain why.</p> },
        { id: 'law', title: 'Governing law', body: <p>These terms are governed by the laws of India. Courts at the operator’s registered location have jurisdiction, without affecting your rights as a consumer.</p> },
        { id: 'contact', title: 'Contact', body: <p><OperatorDetails /></p> },
      ]}
    />
  );
}
