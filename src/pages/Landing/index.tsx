import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChefHat,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  Heart,
  Package,
  MessageCircle,
  Check,
  X,
  ArrowRight,
  Leaf,
  Clock,
  Snowflake,
} from 'lucide-react';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

const VALUE_PROPS = [
  {
    icon: <Leaf size={20} />,
    title: 'Real food, no fillers',
    body: 'Whole-food ingredients you\'d cook with yourself — named meats, real produce, simple supplements. No "meat by-products," no rendered protein, no BHA/BHT, no mystery.',
    color: 'bg-[#eaf6ea] text-[#43a365]',
  },
  {
    icon: <Heart size={20} />,
    title: 'Personalized to your dog',
    body: 'Weight, age, life stage, activity level, allergies, picky-eater flag — Cheffo Doggo scales portions and picks ingredients for the dog in front of you, not "an average 30-pound dog".',
    color: 'bg-[#ffe8cf] text-[#f97316]',
  },
  {
    icon: <Stethoscope size={20} />,
    title: 'Approved by your vet, not some celebrity DVM',
    body: 'Request your own veterinarian\'s sign-off on any recipe with one click. They fill out a one-page form in ~60 seconds. Recipe gets a real "Approved by Dr. X DVM" badge.',
    color: 'bg-[#efe9ff] text-[#7f56d9]',
  },
];

const PROCESSED_INGREDIENTS = [
  '"Meat by-products" — parts that don\'t make the cut for human food',
  'Rendered protein — cooked to slurry at high heat, then dried',
  '"Poultry" or "meat" with no species named on the label',
  'Ground corn, soybean meal as bulk filler',
  'BHA, BHT, ethoxyquin (chemical preservatives)',
  'Artificial colors so kibble "looks" like food',
];

const REAL_INGREDIENTS = [
  'Lean chicken, ground turkey, salmon — named, whole-muscle cuts',
  'Sweet potato, brown rice, quinoa, butternut squash, oats',
  'Carrots, green beans, spinach, kale, blueberries',
  'Olive oil, fish oil, ground flaxseed for healthy fats',
  'Eggshell powder for calcium — no chemical preservatives',
  'Ingredients you can buy at any grocery store',
];

const BATCH_BENEFITS = [
  {
    icon: <Clock size={20} />,
    title: 'One session, a whole week',
    body: 'Set aside an hour. Cook a single big batch instead of prepping a fresh bowl every single night — homemade that actually fits a real schedule.',
    color: 'bg-[#ffe8cf] text-[#f97316]',
  },
  {
    icon: <Package size={20} />,
    title: 'Pre-portioned for your dog',
    body: 'Every batch comes with the exact number of containers and a per-meal portion scaled to your dog’s weight and calories. No daily measuring or guesswork.',
    color: 'bg-[#eaf6ea] text-[#43a365]',
  },
  {
    icon: <Snowflake size={20} />,
    title: 'Fridge + freezer, grab and go',
    body: 'Keep a few days in the fridge, freeze the rest. Thaw, serve, done — with a shopping list so one grocery run covers the whole week.',
    color: 'bg-[#e8f1ff] text-[#2f6fed]',
  },
];

const STEPS = [
  {
    number: 1,
    title: 'Add your dog\'s profile',
    body: 'Weight, age, breed, allergies, medications. Takes about a minute. We use it to personalize every recipe and run safety checks.',
  },
  {
    number: 2,
    title: 'Pick a recipe type',
    body: 'Full meal, weekly batch, topper, treat, or pantry mode (use what you already have). Cheffo Doggo picks safe, balanced ingredients.',
  },
  {
    number: 3,
    title: 'Cook with confidence',
    body: 'Step-by-step instructions, scaled portions, shopping list, optional vet review. Real food, no guesswork.',
  },
];

const RECIPE_TYPES = [
  { icon: <ChefHat size={18} />, label: 'Full meals', desc: 'Balanced, complete homemade dinners' },
  { icon: <CalendarDays size={18} />, label: 'Weekly batches', desc: 'Cook once, feed all week. Freezer-friendly.' },
  { icon: <Sparkles size={18} />, label: 'Toppers', desc: 'Boost kibble with safe, vet-friendly add-ons' },
  { icon: <Heart size={18} />, label: 'Treats', desc: 'Training rewards and pup-cakes for special days' },
  { icon: <Package size={18} />, label: 'Pantry mode', desc: 'Build a recipe from what you already have' },
  { icon: <MessageCircle size={18} />, label: 'Ask Cheffo Doggo', desc: 'AI nutrition assistant for your specific dog' },
];

const FAQ_TEASERS = [
  { q: 'Is this a substitute for veterinary advice?', a: 'No — Cheffo Doggo is educational guidance. Always consult your vet for medical decisions.' },
  { q: 'Why no raw food?', a: 'Lightly-cooked positioning. Raw carries Salmonella, E. coli, Toxoplasma, and salmon-poisoning risk. Cooked is safer with most of the nutritional upside.' },
  { q: 'How much does it cost?', a: '$8/month or $59/year. 14-day money-back guarantee. One free treat recipe to try first.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fffbf5]">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 border-b border-[#eadfce] bg-[#fffbf5]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-[#2b2118]">
            <img src="/cheffo-doggo-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="text-lg font-bold tracking-tight">Cheffo Doggo</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3 text-sm">
            <Link to="/pricing" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Pricing</Link>
            <Link to="/help" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Help</Link>
            <Link to="/login" className="px-3 py-2 text-[#5f564d] hover:text-[#2b2118] font-medium">Sign in</Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#f97316] px-4 py-2 text-white font-semibold shadow-sm hover:bg-[#ea6a0c]"
            >
              Get started
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ea] px-3 py-1 text-xs font-semibold text-[#2f8e56]">
            <Leaf size={12} aria-hidden="true" />
            Real human-food ingredients
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-[#2b2118] sm:text-5xl">
            From ultra-processed kibble<br className="hidden sm:inline" />{' '}
            to <span className="text-[#f97316]">homemade human food.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[#5f564d]">
            Cheffo Doggo turns the same fresh ingredients you cook with — lean chicken, salmon,
            sweet potato, leafy greens — into personalized, vet-informed meals for your dog.
            No "meat by-products," no preservatives, no mystery.
          </p>
          <p className="mt-3 text-base font-medium text-[#3a302a]">
            And homemade doesn’t mean cooking every night — <span className="text-[#f97316] font-semibold">batch a whole week in one session</span>, portion, freeze, and serve.
          </p>
          <p className="mt-2 italic text-[#7f7469]">
            "Real food first. Supplements only when food can't get there."
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
            >
              Try a free treat recipe — no card needed
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#eadfce] bg-white px-6 py-3 text-base font-semibold text-[#2b2118] shadow-sm hover:bg-[#fff6ec]"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-[#9c9288]">No payment required for your dog&rsquo;s first treat · $8/month or $59/year after</p>
        </div>
      </section>

      {/* Transformation: what's actually in your dog's food? */}
      <section className="px-4 py-16 bg-white border-y border-[#eadfce]">
        <div className="mx-auto max-w-5xl">
          <header className="text-center">
            <h2 className="text-3xl font-bold text-[#2b2118]">What's actually in your dog's food?</h2>
            <p className="mt-2 text-[#7f7469] max-w-2xl mx-auto">
              You wouldn't eat ultra-processed food yourself. Your dog deserves better than the
              kibble industry's version of fast food.
            </p>
          </header>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {/* Processed side */}
            <div className="rounded-3xl border border-[#e7e5e4] bg-[#fafaf9] p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a3a39e]">
                Typical commercial dog food
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#5f564d]">Ultra-processed kibble</h3>
              <ul className="mt-5 space-y-3 text-sm text-[#6f6459]">
                {PROCESSED_INGREDIENTS.map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fee2e2] text-[#b91c1c]">
                      <X size={11} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Real side */}
            <div className="rounded-3xl border-2 border-[#43a365] bg-[#f2fbf4] p-6 shadow-[0_8px_24px_-12px_rgba(67,163,101,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2f8e56]">
                A Cheffo Doggo recipe
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#1f5a36]">Real homemade human food</h3>
              <ul className="mt-5 space-y-3 text-sm text-[#1f5a36]">
                {REAL_INGREDIENTS.map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#bfe7cb] text-[#1f5a36]">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-8 text-center text-base text-[#3a302a]">
            <strong className="font-semibold">Make the swap.</strong>{' '}
            Your dog notices. Their coat, energy, digestion, and stool quality usually do too.
          </p>
        </div>
      </section>

      {/* Batch cooking: cook once, feed all week */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#ffe8cf] px-3 py-1 text-xs font-semibold text-[#f97316]">
              <CalendarDays size={12} aria-hidden="true" />
              Built for real life
            </p>
            <h2 className="mt-4 text-3xl font-bold text-[#2b2118]">Cook once. Feed all week.</h2>
            <p className="mt-2 text-[#7f7469] max-w-2xl mx-auto">
              The #1 reason people never switch to homemade is time. So Cheffo Doggo is built
              around batch cooking — make a full week of real meals in a single session, then
              just scoop, thaw, and serve.
            </p>
          </header>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {BATCH_BENEFITS.map(benefit => (
              <div key={benefit.title} className="rounded-3xl border border-[#eadfce] bg-white p-6">
                <div className={['grid h-12 w-12 place-items-center rounded-2xl', benefit.color].join(' ')}>
                  {benefit.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#2b2118]">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5f564d]">{benefit.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
            >
              Start your first weekly batch
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="px-4 py-12 bg-white border-y border-[#eadfce]">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map(prop => (
              <div key={prop.title} className="rounded-3xl bg-[#fffbf5] p-6">
                <div className={['grid h-12 w-12 place-items-center rounded-2xl', prop.color].join(' ')}>
                  {prop.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#2b2118]">{prop.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5f564d]">{prop.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <header className="text-center">
            <h2 className="text-3xl font-bold text-[#2b2118]">How it works</h2>
            <p className="mt-2 text-[#7f7469]">Three steps. About a minute. Then cook.</p>
          </header>
          <ol className="mt-10 space-y-6">
            {STEPS.map(step => (
              <li key={step.number} className="flex items-start gap-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f97316] text-lg font-bold text-white">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#2b2118]">{step.title}</h3>
                  <p className="mt-1 text-[#5f564d] leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can make */}
      <section className="px-4 py-12 bg-[#fff6ec]">
        <div className="mx-auto max-w-5xl">
          <header className="text-center">
            <h2 className="text-3xl font-bold text-[#2b2118]">What you can make</h2>
            <p className="mt-2 text-[#7f7469]">60+ vetted templates across every recipe type.</p>
          </header>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {RECIPE_TYPES.map(type => (
              <div key={type.label} className="rounded-2xl border border-[#eadfce] bg-white p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0de] text-[#f97316]">
                  {type.icon}
                </div>
                <h3 className="mt-3 font-semibold text-[#2b2118]">{type.label}</h3>
                <p className="mt-1 text-sm text-[#7f7469]">{type.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-[#2b2118]">Simple pricing</h2>
          <p className="mt-2 text-[#7f7469]">No ads, no tracking, no upsells. Just food for your dog.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
            <div className="rounded-3xl border border-[#eadfce] bg-white p-6 text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">Monthly</p>
              <p className="mt-3 text-4xl font-bold text-[#2b2118]">$8<span className="text-base font-medium text-[#7f7469]">/mo</span></p>
              <p className="mt-2 text-sm text-[#5f564d]">Cancel anytime.</p>
            </div>
            <div className="rounded-3xl border-2 border-[#f97316] bg-white p-6 text-left shadow-[0_8px_24px_-12px_rgba(249,115,22,0.4)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">Yearly</p>
                <span className="rounded-full bg-[#fff0de] px-2.5 py-1 text-xs font-semibold text-[#f97316]">Save 38%</span>
              </div>
              <p className="mt-3 text-4xl font-bold text-[#2b2118]">$59<span className="text-base font-medium text-[#7f7469]">/yr</span></p>
              <p className="mt-2 text-sm text-[#43a365]">≈ $4.92/month</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-[#5f564d] flex items-center justify-center gap-1.5">
            <Check size={14} className="text-[#43a365]" /> 14-day money-back guarantee — no questions asked
          </p>
          <Link
            to="/pricing"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
          >
            See full plans
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="px-4 py-12 bg-white border-t border-[#eadfce]">
        <div className="mx-auto max-w-3xl">
          <header className="text-center">
            <h2 className="text-2xl font-bold text-[#2b2118]">Common questions</h2>
          </header>
          <div className="mt-6 space-y-4">
            {FAQ_TEASERS.map(faq => (
              <div key={faq.q} className="rounded-2xl bg-[#fffbf5] p-5">
                <p className="font-semibold text-[#2b2118]">{faq.q}</p>
                <p className="mt-1 text-sm text-[#5f564d]">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/help" className="text-[#f97316] font-semibold hover:underline">
              Browse the full help center →
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 bg-gradient-to-b from-[#fff6ec] to-[#fff0de]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#2b2118]">Ready to cook for your dog?</h2>
          <p className="mt-3 text-[#5f564d]">Sign up and make your first recipe in under 5 minutes.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
          >
            Get started — try a free recipe
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-10 bg-[#2b2118] text-[#cbb9a3]">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white">
                <img src="/cheffo-doggo-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
                <span className="text-lg font-bold tracking-tight">Cheffo Doggo</span>
              </div>
              <p className="mt-3 text-sm max-w-sm">
                Real food first. Supplements only when food can't get there.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
              <Link to="/pricing" className="hover:text-white">Pricing</Link>
              <Link to="/help" className="hover:text-white">Help center</Link>
              <Link to="/login" className="hover:text-white">Sign in</Link>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">Contact</a>
            </nav>
          </div>
          <p className="mt-8 border-t border-[#3a302a] pt-6 text-xs text-[#8b7c6a]">
            © {new Date().getFullYear()} Cheffo · Cheffo Doggo is educational guidance only and is not a substitute for veterinary advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
