import React from 'react';
import { LegalLayout, Section } from './sharedLayout';

import { isGooglePlayApp } from '../../utils/distribution';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="September 23, 2026">
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
            plaintext). Provided by you at signup. We also record your confirmation that you are at least 18, the time of that confirmation, and the applicable age-policy version. We do not collect a birth date or identity document for this self-attestation.
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
            <strong>Content reports.</strong> When you report a saved recipe, image, or assistant response,
            we receive the selected content, your reason, any optional note, and your account ID for private
            review. Assistant-message snapshots are submitted by you when you choose to report them.
          </li>
          <li>
            <strong>Recipe-image requests.</strong> For recipes that use AI-generated artwork, the recipe title,
            type, and ingredient descriptions are sent to our AI service to create an image. Generated images
            can be cached in your browser and included with recipes you save to your account.
          </li>
          <li>
            <strong>Optional voice controls.</strong> Cooking Mode can use your browser's speech features after
            you choose Voice Control and grant any microphone permission requested. Depending on your browser
            and device, its speech service may process audio remotely. Cheffo Doggo does not record or store
            the microphone audio; recognized commands are used in the current cooking session. You can stop
            listening or use the on-screen controls instead.
          </li>
          <li>
            <strong>Billing information.</strong> If you subscribe to Premium, Stripe processes your payment.
            <strong> We do not see or store your card number.</strong> We receive only a Stripe customer ID and
            subscription status.
          </li>
          <li>
            <strong>Technical data.</strong> A hashed form of your IP address for rate-limiting public
            endpoints. Browser language and viewport for layout decisions. We use Vercel Web Analytics
            for aggregate page counts, with a temporary visitor hash that expires after 24 hours,
            browser/device details, and approximate country, region, or city information. It does not
            track you across sites. Vercel Speed Insights also collects page
            performance measurements, such as loading time, together with page URLs, browser/device details,
            and country-level information. These measurements help us find performance problems. We do not
            run advertising trackers. We restrict app telemetry to known screen names and omit
            private approval links, record identifiers, and authentication parameters.
          </li>
          <li>
            <strong>Stock recipe images.</strong> Some fallback food photos load directly from Unsplash.
            Your browser sends the network address, browser details, and any referrer allowed by its
            policy when requesting those images; Unsplash handles these requests under its privacy policy.
          </li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To generate personalized recipes and run ingredient safety checks against your dog's allergies and medications.</li>
          <li>To deliver the AI assistant — your messages and dog profile are sent to our language model provider to generate a response.</li>
          <li>To generate recipe artwork from recipe descriptions and ingredients.</li>
          <li>To respond to optional spoken cooking commands through your browser's speech service.</li>
          <li>To measure page performance and improve reliability.</li>
          <li>To process subscriptions and refunds via Stripe.</li>
          <li>To send vet-approval emails (only when you request one) and account emails (password reset, billing receipts) via our email provider.</li>
          <li>To prevent abuse (rate limits on the AI assistant and public approval endpoints).</li>
          <li>To respond to your support requests and privately review reported content.</li>
        </ul>
      </Section>

      <Section title="Service providers we share with">
        <p>We share data only with the services we need to operate the app:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase</strong> — database hosting and authentication. Stores your account, dog profiles, recipes, and approvals.</li>
          <li><strong>Vercel</strong> — application hosting, serverless functions, cookieless aggregate page analytics, and Speed Insights performance measurements.</li>
          <li><strong>Stripe</strong> — subscription billing and payment processing. Handles all card data directly.</li>
          <li><strong>Unsplash</strong> — serves fallback food photos directly to your browser. See its <a className="text-[#f97316] underline" href="https://unsplash.com/privacy">privacy policy</a> for its processing of image requests.</li>
          <li><strong>Resend</strong> — transactional email (vet-approval emails, password reset).</li>
          <li><strong>Our AI service providers</strong> — process assistant messages and relevant dog-profile information to generate replies, and recipe descriptions and ingredients to generate artwork. Provider processing and retention are governed by the terms applicable to the configured service.</li>
          <li><strong>Your browser or device's speech service</strong> — handles optional voice recognition and spoken playback. Processing may happen on your device or remotely, depending on that service and your settings; its privacy terms also apply.</li>
        </ul>
        <p>We do not sell your data. We do not share data with advertisers.</p>
      </Section>

      <Section title="How we protect your information">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Encrypted in transit.</strong> All connections use HTTPS / TLS.</li>
          <li><strong>Encrypted at rest.</strong> Our database provider encrypts stored data.</li>
          <li><strong>Per-user row-level security.</strong> Each user can only read and modify their own data; this is enforced by the database itself, not just application code.</li>
          <li><strong>Server-side secrets.</strong> Provider API keys live only in server-side environment variables. The client never sees them.</li>
          <li><strong>Passwords.</strong> Hashed by our authentication provider before storage; we never see or store the plaintext.</li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          We retain account information while your account exists. Content reports remain until your account
          is deleted or we remove them during review. The deletion process below removes your associated
          records from the app's active database. Payment-provider records, security logs, and records we
          must keep for legal obligations may be retained separately under the applicable requirements
          and provider policies.
        </p>
      </Section>

      <Section title="Delete your account" id="delete-account">
        <p>
          In Cheffo Doggo, open Settings, choose Delete my account, and follow the confirmation steps.
          This requests deletion of your account and associated data, including dog profiles, saved recipes
          and their images, preferences, vet approvals, content reports, AI usage records, subscription-access
          records, and your age confirmation. An existing Stripe subscription recorded in your account
          is cancelled as part of the in-app deletion process.
        </p>
        <p>
          If you cannot use the app, email{' '}
          <a
            className="text-[#f97316] underline"
            href={'mailto:' + SUPPORT_EMAIL + '?subject=Cheffo%20Doggo%20account%20deletion'}
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          from your account email address with the subject “Cheffo Doggo account deletion” and ask us to
          delete your account and associated data. We may need to verify account ownership before
          completing the request.
        </p>
        <p>
          Stripe may retain payment and transaction records under its retention policies and financial
          requirements. Security logs and records required by law may also be retained; they are not
          covered by the app's account-record deletion. Chat history and image caches stored only on your
          device can be removed by clearing Cheffo Doggo site data in your browser. Deleting those local
          copies alone does not delete your account.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You can, at any time:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Export your data.</strong> Settings → Download my data exports a JSON file with everything we hold.</li>
          <li><strong>Delete your account.</strong> Follow the <a className="text-[#f97316] underline" href="#delete-account">account-deletion steps above</a>, including the email option if you cannot use the app.</li>
          <li><strong>Correct your data.</strong> Edit dog profiles, recipes, and preferences directly in the app.</li>
          <li><strong>Cancel your subscription.</strong> {isGooglePlayApp() ? 'Contact support to cancel an existing subscription.' : "Settings → Manage subscription opens Stripe's portal."}</li>
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
          Cheffo Doggo is intended only for adults aged 18 and older. We do not knowingly collect personal
          information from anyone under 18. If you believe someone under 18 has created an account, contact
          us so we can investigate and delete the account and associated information.
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
          AI assistant, generated-image cache, lightweight preferences (units, recently-used templates), and the
          time of your last visit. Clearing site data removes the browser's local copies; it does not by itself
          delete information already saved to your account.
          We also count a small set of product steps (such as preview started, signup completed, and recipe generated)
          with a known screen name and supported acquisition-source label only; these funnel events do not include email, dog details, recipe contents,
          or raw IP addresses. We do not use third-party
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
