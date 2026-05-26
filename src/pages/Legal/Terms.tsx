import React from 'react';
import { LegalLayout, Section } from './sharedLayout';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';
const GOVERNING_LAW_STATE = 'the State of [your state]'; // TODO: Beth — set this before public launch (typically your business's state of incorporation).

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" effectiveDate="May 25, 2026">
      <Section title="Acceptance">
        <p>
          By creating a Cheffo Doggo account or otherwise using our website, mobile apps, or services
          (collectively, the "Service"), you agree to these Terms of Service. If you don't agree, don't use the
          Service.
        </p>
        <p>
          If you're using the Service on behalf of someone else (for example, a household member), you confirm
          you have the authority to bind them to these terms.
        </p>
      </Section>

      <Section title="What Cheffo Doggo is — and what it isn't">
        <p>
          Cheffo Doggo provides software-based educational guidance for homemade dog food preparation. We help
          you generate recipes, scale portions, manage shopping lists, and request optional vet approval from your
          own veterinarian.
        </p>
        <p>
          <strong>Cheffo Doggo is not a substitute for veterinary care.</strong> Recipes, calorie estimates,
          portion sizes, supplement recommendations, and any other content in the Service are educational
          starting points only. Always consult a licensed veterinarian or veterinary nutritionist before making
          dietary changes for your dog, particularly for puppies, seniors, pregnant or nursing dogs, and dogs
          with medical conditions or on prescription food.
        </p>
        <p>
          The Service does not diagnose, treat, cure, or prevent any condition in your dog.
        </p>
      </Section>

      <Section title="Account eligibility and security">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 13 years old (or 16 in jurisdictions where that's the applicable age) to create an account.</li>
          <li>You agree to provide accurate information about yourself and your dog. Inaccurate dog profiles can produce inappropriate recipes.</li>
          <li>You're responsible for keeping your password confidential. Notify us immediately at <a className="text-[#f97316] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you suspect unauthorized access.</li>
          <li>One account per person. Premium subscriptions cover one account; if you need multiple household members to have their own logins, contact us.</li>
        </ul>
      </Section>

      <Section title="Subscription, billing, and auto-renewal">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Plans and pricing.</strong> Cheffo Doggo Premium is <strong>$8 USD per month</strong> or
            <strong> $59 USD per year</strong>. Prices are exclusive of taxes, which may be added based on your
            jurisdiction.
          </li>
          <li>
            <strong>Auto-renewal.</strong> Subscriptions renew automatically at the end of each billing period
            (monthly or yearly) at the then-current published price, charged to the payment method on file. By
            subscribing you authorize this recurring charge until you cancel.
          </li>
          <li>
            <strong>Cancellation.</strong> You can cancel at any time from Settings → Manage subscription. Access
            continues through the end of the current billing period; no further charges occur.
          </li>
          <li>
            <strong>14-day money-back guarantee.</strong> If you're not satisfied within 14 days of your initial
            Premium purchase, email <a className="text-[#f97316] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            for a full refund. No questions asked. This guarantee applies to your first purchase only.
          </li>
          <li>
            <strong>Free tier.</strong> Free users may generate one (1) treat recipe per account; all other
            features are Premium-only.
          </li>
          <li>
            <strong>Price changes.</strong> We may change Premium pricing in the future with at least 30 days'
            notice via email or in-app message. Continuing the subscription after the change constitutes acceptance.
          </li>
        </ul>
      </Section>

      <Section title="Your content; license to operate">
        <p>
          You own your dog profiles, recipes, and other content you provide. By providing this content you grant
          us a worldwide, non-exclusive, royalty-free license to host, copy, process, transmit, and display
          this content as needed to provide the Service to you. We do not claim ownership of your content and
          we don't use it for any purpose unrelated to running the Service.
        </p>
      </Section>

      <Section title="AI assistant and AI-generated content">
        <p>
          The in-app assistant ("Ask Cheffo Doggo") is powered by a third-party large language model. Outputs
          are generated and may contain errors, omissions, or inaccurate information. Treat AI outputs as a
          starting point, not authoritative advice. Verify portions, supplements, and ingredient safety against
          published veterinary sources or your own vet.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree NOT to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Service for any unlawful purpose, or to violate any local, state, federal, or international law.</li>
          <li>Scrape, automate, or extract data from the Service except via interfaces we explicitly provide (e.g. data export).</li>
          <li>Resell, sublicense, or otherwise commercially redistribute Service content (e.g. selling generated recipes as your own product).</li>
          <li>Attempt to reverse-engineer, decompile, or extract source code from the Service.</li>
          <li>Use the Service to harm or train competing AI models.</li>
          <li>Interfere with the operation of the Service (denial of service, exploits, etc.).</li>
        </ul>
        <p>We may suspend or terminate accounts that violate these rules, with or without notice.</p>
      </Section>

      <Section title="Vet approval workflow">
        <p>
          The vet-approval feature lets you request a review of a recipe from your own veterinarian via email.
          Cheffo Doggo is not a veterinary practice and does not employ veterinarians. Any review or sign-off is
          provided by your independent vet, who is solely responsible for their own professional judgment. We
          host the form and deliver the email; we do not endorse, certify, or supervise the reviewing
          veterinarian.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, OR THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
        </p>
        <p>
          WE MAKE NO GUARANTEE THAT RECIPES OR DIETARY GUIDANCE WILL BE APPROPRIATE FOR YOUR SPECIFIC DOG. FOOD
          PREFERENCES, ALLERGIES, AND DIETARY NEEDS VARY BY INDIVIDUAL ANIMAL. YOU ARE SOLELY RESPONSIBLE FOR
          MONITORING YOUR DOG'S RESPONSE TO ANY HOMEMADE DIET AND FOR CONSULTING A LICENSED VETERINARIAN ABOUT
          THEIR HEALTH.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL CHEFFO DOGGO, ITS OWNERS, EMPLOYEES, OR
          AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
          LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR IN CONNECTION WITH THE SERVICE, EVEN IF WE
          HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR TOTAL CUMULATIVE LIABILITY FOR ANY CLAIM ARISING FROM OR RELATED TO THE SERVICE WILL NOT EXCEED THE
          AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR
          USD $100, WHICHEVER IS GREATER.
        </p>
        <p>
          Some jurisdictions do not allow the exclusion of certain warranties or limitations on liability for
          consequential damages, so the above may not apply to you in full.
        </p>
      </Section>

      <Section title="Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Cheffo Doggo, its owners, employees, and affiliates
          from any claim or demand, including reasonable attorneys' fees, arising out of (a) your use of the
          Service, (b) your violation of these terms, or (c) your violation of any rights of another party,
          including your dog's health or any claim arising from a recipe you generated or shared.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using the Service and delete your account at any time from Settings. We may suspend or
          terminate your access if you violate these terms or for other legitimate business reasons, with
          reasonable notice when feasible.
        </p>
        <p>
          Provisions intended by their nature to survive termination — including but not limited to disclaimers,
          limitation of liability, indemnification, and governing law — survive.
        </p>
      </Section>

      <Section title="Governing law and disputes">
        <p>
          These terms are governed by the laws of {GOVERNING_LAW_STATE}, without regard to its conflict of laws
          rules. Any dispute will be brought exclusively in the state or federal courts located in
          {' '}{GOVERNING_LAW_STATE.replace(/^the State of /, '')}, and you consent to the personal jurisdiction
          of those courts.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms as the Service evolves. Material changes will be communicated through the
          app or by email at least 14 days before they take effect, except for changes required by law which may
          take effect immediately. Continuing to use the Service after the effective date constitutes acceptance.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For questions about these terms, email <a className="text-[#f97316] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
