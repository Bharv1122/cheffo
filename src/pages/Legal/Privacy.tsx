import React from 'react';
import { LegalLayout, Section } from './sharedLayout';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="May 25, 2026">
      <Section title="Summary">
        <p>
          Cheffo Doggo helps you cook homemade meals for your dog. To do that, we collect the minimum information
          needed to personalize recipes, run safety checks, and bill subscriptions. We don't sell data, don't run
          ads, and don't share information with third parties beyond the services we use to operate the app.
        </p>
        <p>
          You can export everything we hold for you, or delete your account entirely, from inside Settings.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>When you use Cheffo Doggo we collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Account information.</strong> Email address and a password (hashed; we never see the
            plaintext). Provided by you at signup.
          </li>
          <li>
            <strong>Dog profiles.</strong> Information about your dog(s) — name, breed, age, weight, life stage,
            activity level, allergies, medications, foods to avoid, favorite proteins, picky-eater flag, parent
            skill level, texture preference. Provided by you.
          </li>
          <li>
            <strong>Recipes and preferences.</strong> Recipes you generate or save, settings (units, batch
            duration, favorite recipes), vet-approval requests and outcomes.
          </li>
          <li>
            <strong>Chat messages.</strong> Conversations with the in-app AI assistant, including the dog profile
            attached to each conversation. Used to personalize replies and saved locally for conversation history.
          </li>
          <li>
            <strong>Billing information.</strong> If you subscribe to Premium, Stripe processes your payment.
            <strong> We do not see or store your card number.</strong> We receive only a Stripe customer ID and
            subscription status.
          </li>
          <li>
            <strong>Technical data.</strong> A salted, hashed form of your IP address for rate-limiting public
            endpoints (we cannot reverse this back to your IP). Browser language and viewport for layout
            decisions. We do not run third-party analytics or advertising trackers in v1.0.
          </li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To generate personalized recipes and run ingredient safety checks against your dog's allergies and medications.</li>
          <li>To deliver the AI assistant — your messages and dog profile are sent to our language model provider to generate a response.</li>
          <li>To process subscriptions and refunds via Stripe.</li>
          <li>To send vet-approval emails (only when you request one) and account emails (password reset, billing receipts) via our email provider.</li>
          <li>To prevent abuse (rate limits on the AI assistant and public approval endpoints).</li>
          <li>To respond to your support requests.</li>
        </ul>
      </Section>

      <Section title="Service providers we share with">
        <p>We share data only with the services we need to operate the app:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase</strong> — database hosting and authentication. Stores your account, dog profiles, recipes, and approvals.</li>
          <li><strong>Vercel</strong> — application hosting and serverless functions.</li>
          <li><strong>Stripe</strong> — subscription billing and payment processing. Handles all card data directly.</li>
          <li><strong>Resend</strong> — transactional email (vet-approval emails, password reset).</li>
          <li><strong>Our language-model provider</strong> — processes your assistant chat messages and dog profile to generate responses. We do not allow the provider to train their models on your data.</li>
        </ul>
        <p>We do not sell your data. We do not share data with advertisers.</p>
      </Section>

      <Section title="How we protect your information">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Encrypted in transit.</strong> All connections use HTTPS / TLS.</li>
          <li><strong>Encrypted at rest.</strong> Our database provider encrypts stored data.</li>
          <li><strong>Per-user row-level security.</strong> Each user can only read and modify their own data; this is enforced by the database itself, not just application code.</li>
          <li><strong>Server-side secrets.</strong> Provider API keys live only in server-side environment variables. The client never sees them.</li>
          <li><strong>Passwords.</strong> Hashed by our authentication provider before storage. We check new passwords against the HaveIBeenPwned database to block known-breached passwords.</li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          We retain your information for as long as your account exists. When you delete your account (Settings →
          Delete my account), we permanently remove all associated data within a reasonable time, including dog
          profiles, recipes, preferences, approvals, and AI usage records. Stripe customer records persist on
          Stripe's side as required by financial regulations; please contact Stripe for their data retention.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You can, at any time:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Export your data.</strong> Settings → Download my data exports a JSON file with everything we hold.</li>
          <li><strong>Delete your account.</strong> Settings → Delete my account permanently removes your data.</li>
          <li><strong>Correct your data.</strong> Edit dog profiles, recipes, and preferences directly in the app.</li>
          <li><strong>Cancel your subscription.</strong> Settings → Manage subscription opens Stripe's portal.</li>
          <li>
            <strong>Contact us</strong> at <a className="text-[#f97316] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for
            any privacy question, or to exercise a right not directly self-service in the app.
          </li>
        </ul>
        <p>
          If you are in the EU/EEA, UK, California, or other jurisdictions with specific privacy laws (GDPR,
          UK-GDPR, CCPA/CPRA), you may have additional rights including the right to object, restrict processing,
          or lodge a complaint with your supervisory authority. Email us and we'll honor those rights.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>
          Cheffo Doggo is not directed at children. We do not knowingly collect personal information from anyone
          under 13 years old (or under 16, in jurisdictions where that's the applicable age). If you believe a
          child has created an account, email us and we'll delete it.
        </p>
      </Section>

      <Section title="International data transfers">
        <p>
          Our service providers operate primarily in the United States. If you use Cheffo Doggo from outside the
          US, your information will be transferred to and processed in the US. By using the app you consent to
          that transfer.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We use browser local storage to keep your authentication session, your conversation history with the
          AI assistant, and lightweight preferences (units, recently-used templates). We do not use third-party
          tracking cookies or advertising cookies in v1.0.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as the app evolves. Material changes will be communicated through the app
          or by email. Your continued use of Cheffo Doggo after the effective date of changes constitutes
          acceptance of the updated policy.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For any privacy question, email <a className="text-[#f97316] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          We read every message and aim to respond within a few business days.
        </p>
      </Section>
    </LegalLayout>
  );
}
