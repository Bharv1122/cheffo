import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Mail, ChefHat, ShieldCheck, Stethoscope, CreditCard, Lock } from 'lucide-react';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

interface QA {
  q: string;
  a: React.ReactNode;
}

interface Category {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  questions: QA[];
}

const CATEGORIES: Category[] = [
  {
    title: 'Getting started',
    icon: <ChefHat size={16} />,
    iconBg: 'bg-[#fff0de]',
    iconColor: 'text-[#f97316]',
    questions: [
      {
        q: 'What is Cheffo Doggo?',
        a: (
          <p>
            Cheffo Doggo helps you cook homemade meals for your dog — full meals, batches, toppers, treats, and pantry-based recipes — all
            personalized to your dog's weight, age, allergies, and preferences. Every recipe is checked against a toxic-ingredients database
            and built to be safe.
          </p>
        ),
      },
      {
        q: 'How do I make my first recipe?',
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Add your dog's profile (weight, age, breed, any allergies).</li>
            <li>Open Bowl Builder and pick a recipe type — full meal, batch, topper, or treat.</li>
            <li>Click "Generate Recipe". Cheffo Doggo picks safe ingredients, scales portions, and writes the steps.</li>
          </ol>
        ),
      },
      {
        q: 'Do I need to add a dog profile?',
        a: <p>Yes — Cheffo Doggo uses weight, age, life stage, and allergies to personalize portions and run safety checks on every recipe.</p>,
      },
      {
        q: 'What if I have multiple dogs?',
        a: (
          <p>
            Add a profile for each dog. The "For which dog?" selector on Bowl Builder lets you switch which dog the recipe is built for. Each
            dog's allergies and medications are checked independently.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Safety',
    icon: <ShieldCheck size={16} />,
    iconBg: 'bg-[#eaf6ea]',
    iconColor: 'text-[#43a365]',
    questions: [
      {
        q: 'Is Cheffo Doggo a substitute for veterinary advice?',
        a: (
          <p>
            <strong>No.</strong> Cheffo Doggo provides general educational guidance about homemade dog food, not veterinary advice. Always
            consult a licensed veterinarian or veterinary nutritionist before making major changes to your dog's diet — especially for
            puppies, seniors, pregnant or nursing dogs, and dogs with medical conditions or on prescription food.
          </p>
        ),
      },
      {
        q: 'What ingredients are off-limits?',
        a: (
          <p>
            We hard-block: chocolate, grapes, raisins, onion, garlic (and their powders), xylitol, macadamia nuts, alcohol, caffeine,
            avocado, raw yeast dough, and nutmeg. Every generated recipe runs through this check, and the chat assistant won't recommend
            them either.
          </p>
        ),
      },
      {
        q: 'Why no raw meat?',
        a: (
          <p>
            Cheffo Doggo is a lightly-cooked-only brand. Raw meat carries real risks — Salmonella, E. coli, Toxoplasma, salmon-poisoning
            disease in the Pacific Northwest. Lightly cooked food preserves most of the nutritional benefits without the pathogen exposure.
            Raw fruits and vegetables (like carrots, blueberries, cucumber) are fine and recommended where appropriate.
          </p>
        ),
      },
      {
        q: 'What about my dog\'s allergies?',
        a: (
          <p>
            Add allergies to your dog's profile and Cheffo Doggo will avoid those ingredients in every generated recipe. If you spot one
            that slipped through, please email us — we treat allergy false-negatives as critical.
          </p>
        ),
      },
      {
        q: 'My dog is on medication. Are food interactions checked?',
        a: (
          <p>
            We check for known food-medication interactions (e.g. warfarin + fish oil = bleeding risk). The chat assistant flags known
            interactions when you ask. Always confirm with your vet — drug interactions are an active research area.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Vet approval',
    icon: <Stethoscope size={16} />,
    iconBg: 'bg-[#efe9ff]',
    iconColor: 'text-[#7f56d9]',
    questions: [
      {
        q: 'How does vet approval work?',
        a: (
          <p>
            On any recipe page, request approval from <em>your own veterinarian</em>. We email them a one-page review form (takes ~60
            seconds) — approve, approve with notes, or decline. Once they sign off, the recipe gets a "Approved by Dr. X DVM" badge.
          </p>
        ),
      },
      {
        q: 'Does it cost the vet anything?',
        a: (
          <p>
            No. Vets review free of charge. Your vet may apply their normal consultation fee — please let them know in advance. We never
            charge a vet anything.
          </p>
        ),
      },
      {
        q: 'What if my vet declines or never replies?',
        a: (
          <p>
            That's fine — the app still works. Vet approval is a confidence boost, not a requirement. Approval links expire after 30 days
            if not used.
          </p>
        ),
      },
      {
        q: 'Can I edit a recipe after my vet approved it?',
        a: (
          <p>
            If you change the recipe enough that the new version exceeds the vet's approval envelope (±10% calories, ±15% protein, same
            primary protein), the approval badge no longer applies. Small edits within those bounds inherit the original approval.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Subscription & billing',
    icon: <CreditCard size={16} />,
    iconBg: 'bg-[#ffe8cf]',
    iconColor: 'text-[#f97316]',
    questions: [
      {
        q: 'What does Premium include?',
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Unlimited personalized full-meal, batch, topper, and pantry-mode recipes</li>
            <li>Ask Cheffo Doggo — the AI canine-nutrition assistant</li>
            <li>Vet Export PDFs + the distributed vet-approval flow</li>
            <li>AI ingredient swaps and image generation per recipe</li>
          </ul>
        ),
      },
      {
        q: 'What\'s free?',
        a: (
          <p>
            Free users get one treat recipe as a taste. Everything else is Premium. There's no traditional free trial — instead we offer a
            14-day money-back guarantee. If Premium isn't right for you and your dog, email us within 14 days for a full refund. No
            questions asked.
          </p>
        ),
      },
      {
        q: 'How much does Premium cost?',
        a: (
          <p>
            <strong>$8 per month</strong> or <strong>$59 per year</strong> (roughly $4.92/month — saves 38%). Both renew automatically; cancel
            anytime.
          </p>
        ),
      },
      {
        q: 'How do I cancel?',
        a: (
          <p>
            Open <Link to="/settings" className="text-[#f97316] underline">Settings</Link> → "Manage subscription" → cancel from Stripe's
            customer portal. Your access continues through the end of the current billing period.
          </p>
        ),
      },
      {
        q: 'How do I get a refund?',
        a: (
          <p>
            Email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#f97316] underline">{SUPPORT_EMAIL}</a> within 14 days of your initial
            purchase with your account email. We'll refund the full amount. No questions asked.
          </p>
        ),
      },
      {
        q: 'I subscribed but Premium isn\'t showing up. What gives?',
        a: (
          <p>
            Stripe usually marks your account Active within ~5 seconds, but in rare cases the webhook is delayed. Refresh the Settings page
            after a minute. Still stuck? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#f97316] underline">{SUPPORT_EMAIL}</a> with your account email and we'll
            sort it manually.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Account & privacy',
    icon: <Lock size={16} />,
    iconBg: 'bg-[#e9f8f5]',
    iconColor: 'text-[#1f9f84]',
    questions: [
      {
        q: 'How do I export my data?',
        a: (
          <p>
            Open <Link to="/settings" className="text-[#f97316] underline">Settings</Link> → "Download my data". You get a JSON file with
            every dog profile, saved recipe, preference, and approval we hold for you.
          </p>
        ),
      },
      {
        q: 'How do I delete my account?',
        a: (
          <p>
            Open <Link to="/settings" className="text-[#f97316] underline">Settings</Link> → "Delete my account". You'll be asked to type
            your email to confirm. Account deletion is immediate and permanent — your dogs, recipes, preferences, and login are all wiped.
            Active subscriptions need to be cancelled separately first via the billing portal.
          </p>
        ),
      },
      {
        q: 'What data do you store?',
        a: (
          <p>
            Dog profiles, saved recipes, preferences, vet-approval history, and chat messages with the assistant. We don't sell data, don't
            run ads, and don't share information with third parties beyond what's needed to operate the app (Supabase for storage, Stripe
            for billing, Resend for email, our LLM provider for chat).
          </p>
        ),
      },
      {
        q: 'Is my data encrypted?',
        a: (
          <p>
            Yes. Data is encrypted in transit (HTTPS) and at rest (Supabase Postgres). Your password is hashed by Supabase Auth before
            storage — we never see it.
          </p>
        ),
      },
      {
        q: 'Can I share my account with another household member?',
        a: (
          <p>
            One Premium subscription covers one account. If you'd like multiple people in your household to have their own logins, please
            contact us — we'll work something out.
          </p>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#fffbf5] py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-[#7f7469] hover:text-[#2b2118]">
          <ArrowLeft size={14} /> Back to Settings
        </Link>

        <header className="mt-6 text-center">
          <h1 className="text-3xl font-bold text-[#2b2118]">Help center</h1>
          <p className="mt-2 text-[#7f7469]">Common questions about Cheffo Doggo. Can't find your answer? Email us.</p>
        </header>

        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Cheffo Doggo support')}`}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[#eadfce] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b2118] shadow-sm transition-colors hover:bg-[#fff6ec]"
        >
          <Mail size={16} aria-hidden="true" />
          Email {SUPPORT_EMAIL}
        </a>

        <div className="mt-8 space-y-6">
          {CATEGORIES.map(category => (
            <section key={category.title} className="doggo-card p-5">
              <h2 className="flex items-center gap-3 text-lg font-semibold text-[#2b2118]">
                <span className={['grid h-9 w-9 place-items-center rounded-xl', category.iconBg, category.iconColor].join(' ')}>
                  {category.icon}
                </span>
                {category.title}
              </h2>
              <div className="mt-3 divide-y divide-[#eadfce]">
                {category.questions.map(qa => (
                  <FAQItem key={qa.q} q={qa.q} a={qa.a} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[#9c9288]">
          Still stuck? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">
            {SUPPORT_EMAIL}
          </a>
          . We read every message.
        </p>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: QA) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="group py-3"
      open={open}
      onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-[#2b2118] list-none">
        <span>{q}</span>
        <ChevronDown
          size={16}
          className={['shrink-0 text-[#8b8378] transition-transform mt-0.5', open ? 'rotate-180' : ''].join(' ')}
          aria-hidden="true"
        />
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-[#5f564d]">{a}</div>
    </details>
  );
}
