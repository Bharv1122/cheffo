import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChefHat,
  CalendarDays,
  CirclePlay,
  Sparkles,
  Stethoscope,
  Heart,
  Package,
  MessageCircle,
  Check,
  ArrowRight,
  Leaf,
  Clock,
  Snowflake,
} from 'lucide-react';
import { GuestTreat } from '../../components/landing/GuestTreat';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

const VALUE_PROPS = [
  {
    icon: <Leaf size={20} />,
    title: 'Ingredients you recognize',
    body: 'See every ingredient, amount, and preparation step. Know what goes into the bowl.',
    color: 'bg-[#eaf6ea] text-[#43a365]',
  },
  {
    icon: <Heart size={20} />,
    title: 'Personalized to your dog',
    body: 'Recipes shaped around your dog’s weight, life stage, activity, and ingredient preferences.',
    color: 'bg-[#ffe8cf] text-[#f97316]',
  },
  {
    icon: <Stethoscope size={20} />,
    title: 'Built for your own vet to review',
    body: 'Share recipes, portions, and supplement notes with your own veterinarian before changing your dog’s diet.',
    color: 'bg-[#efe9ff] text-[#7f56d9]',
  },
];

const BATCH_BENEFITS = [
  {
    icon: <Clock size={20} />,
    title: 'One session, a whole week',
    body: 'A weekly recipe and one shopping list. Prep a batch when it suits your schedule.',
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
    body: 'Choose full meal, weekly batch, topper, treat, or pantry mode. Non-subscribers get one free treat recipe; homemade food recipes require a paid plan.',
  },
  {
    number: 3,
    title: 'Cook with confidence',
    body: 'Step-by-step instructions, scaled portions, shopping list, and a completed vet approval packet you can review before sending.',
  },
];

const RECIPE_TYPES = [
  { icon: <ChefHat size={18} />, label: 'Full meals', desc: 'Personalized homemade meal plans for vet review' },
  { icon: <CalendarDays size={18} />, label: 'Weekly batches', desc: 'Cook once, feed all week. Freezer-friendly.' },
  { icon: <Sparkles size={18} />, label: 'Toppers', desc: 'Boost kibble with safe, vet-friendly add-ons' },
  { icon: <Heart size={18} />, label: 'Treats', desc: 'Training rewards and pup-cakes for special days' },
  { icon: <Package size={18} />, label: 'Pantry mode', desc: 'Build a recipe from what you already have' },
  { icon: <MessageCircle size={18} />, label: 'Ask Cheffo Doggo', desc: 'AI nutrition assistant for your specific dog' },
];

const FAQ_TEASERS = [
  { q: 'Is this a substitute for veterinary advice?', a: 'No — Cheffo Doggo is educational guidance. Always consult your vet for medical decisions.' },
  { q: 'Why no raw food?', a: 'Cheffo Doggo focuses on cooked recipes, with preparation instructions and ingredient notes to discuss with your veterinarian.' },
  { q: 'How much does it cost?', a: '$8/month or $59/year. 14-day money-back guarantee. One free treat recipe to try first.' },
];

function DemoVideo() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#eadfce] bg-[#21150e] shadow-[0_20px_45px_-24px_rgba(43,33,24,0.45)]">
      <video
        key="cheffo-doggo-demo-v6"
        ref={videoRef}
        src="/cheffo-doggo-demo-v6.mp4"
        controls
        playsInline
        preload="none"
        poster="/demo-poster-v2.png"
        className="block aspect-[16/10] w-full bg-[#21150e] object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {!isPlaying && (
        <button
          type="button"
          onClick={() => videoRef.current?.play()}
          className="videoPlayOverlay absolute left-1/2 top-1/2 inline-flex min-h-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 rounded-full border border-white/70 bg-[#f97316] px-6 text-base font-bold text-white shadow-[0_18px_42px_rgba(43,27,18,0.32)] hover:bg-[#ea6a0c]"
        >
          <CirclePlay size={24} aria-hidden="true" />
          Play demo
        </button>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fffbf5] pb-20 sm:pb-0">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 border-b border-[#eadfce] bg-[#fffbf5]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-[#2b2118]">
            <img src="/cheffo-doggo-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="whitespace-nowrap text-base sm:text-lg font-bold tracking-tight">Cheffo Doggo</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3 text-sm">
            <Link to="/pricing" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Pricing</Link>
            <Link to="/calculator" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Calculator</Link>
            {/* Plain <a>: /learn/ is a static page outside the SPA router —
                a <Link> would client-route into the catch-all redirect. */}
            <a href="/learn/" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Learn</a>
            <Link to="/help" className="hidden sm:inline-block px-3 py-2 text-[#5f564d] hover:text-[#2b2118]">Help</Link>
            <Link to="/login" className="whitespace-nowrap px-2 sm:px-3 py-2 text-[#5f564d] hover:text-[#2b2118] font-medium">Sign in</Link>
            <Link
              to="/signup"
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-2xl bg-[#f97316] px-3 sm:px-4 py-2 text-white font-semibold shadow-sm hover:bg-[#ea6a0c]"
            >
              Free treat
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
      <section className="px-5 pb-12 pt-7 sm:px-8 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div>
            <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#97602f]"><Leaf size={15} aria-hidden="true" /> A little homemade. A lot of love.</p>
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight text-[#2b2118] sm:text-6xl">Homemade meals.<br /><span className="text-[#bd4a0b]">Made for<br className="hidden lg:block" /> your dog.</span></h1>
            <p className="mt-4 sm:mt-6 max-w-lg text-base sm:text-lg leading-relaxed text-[#5f564d]">Fresh ingredients. Portions for your pup. Simple recipes and weekly meal plans to make cooking for your dog feel doable.</p>
            <a href="#free-treat" className="mt-5 sm:mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#bd4a0b] px-7 py-3.5 font-bold text-white shadow-sm hover:bg-[#993b09]">Try a free treat recipe <ArrowRight size={18} aria-hidden="true" /></a>
            <p className="mt-3 text-sm text-[#756657]">Preview first. No card needed.</p>
            <div className="mt-5 sm:mt-8 flex items-center gap-3 border-t border-[#e3d4c2] pt-5 text-[#3e4933]"><CalendarDays size={24} aria-hidden="true" /><div><p className="font-bold">Cook once. Feed all week.</p><p className="text-sm text-[#756657]">Your plan, shopping list, and freezer portions.</p></div></div>
          </div>
          <div className="relative pb-9">
            <img src="/landing-dog-bowl.webp" alt="Cooper beside a bowl of cooked chicken, vegetables, and rice in a sunny kitchen" width="1536" height="1024" fetchPriority="high" className="aspect-[4/5] max-h-[580px] w-full rounded-[2rem] object-cover sm:aspect-[1.05/1]" />
            <div className="absolute bottom-0 left-4 right-4 rounded-2xl border border-[#e3d4c2] bg-white p-5 shadow-lg sm:left-6 sm:right-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#97602f]">Inside Cheffo Doggo · sample recipe</p>
              <h2 className="mt-2 text-xl font-bold text-[#2b2118]">Turkey, Oat &amp; Veggie Bowl</h2>
              <p className="mt-1 text-sm text-[#756657]">Ingredients → portions → cooking steps</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#3e4933]"><span>✓ Shopping list</span><span>✓ Batch plan</span><span>✓ Vet review packet</span></div>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e3d4c2] bg-[#f2ecdf] px-5 py-7">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-3">
          {VALUE_PROPS.map(prop => <div key={prop.title} className="flex gap-3"><span className="mt-1 text-[#bd4a0b]">{prop.icon}</span><div><h2 className="font-bold text-[#2b2118]">{prop.title}</h2><p className="mt-1 text-sm leading-relaxed text-[#5f564d]">{prop.body}</p></div></div>)}
        </div>
      </section>
      <section id="free-treat" className="scroll-mt-24 px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#97602f]">Start with something small</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2b2118] sm:text-4xl">A treat with<br />their name on it.</h2><p className="mt-4 max-w-md leading-relaxed text-[#5f564d]">Tell us a little about your dog to see a real treat idea. Create a free account when you’re ready for the amounts and steps.</p><p className="mt-4 text-sm text-[#756657]">One free treat recipe. Meal plans and weekly batches are included with Premium.</p></div>
          <GuestTreat />
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
              Make room for homemade in a busy week. Plan your meals, prep a batch,
              portion it out, and freeze what you’ll need later.
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
              Subscribe for weekly batches
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <header className="text-center">
            <h2 className="text-3xl font-bold text-[#2b2118]">How it works</h2>
            <p className="mt-2 text-[#7f7469]">From your dog’s profile to a plan you can review with your vet.</p>
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

      {/* Full walkthrough demo + vet approval packet */}
      <section className="px-4 py-16 bg-white border-y border-[#eadfce]">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold text-[#f97316]">
              <CirclePlay size={12} aria-hidden="true" />
              Full site demo
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#2b2118]">
              See what’s cooking.
            </h2>
            <p className="mt-3 leading-relaxed text-[#5f564d]">
              Take a look at the recipes, batch plans, and vet review tools before you sign up.
            </p>

            <div className="mt-6 rounded-3xl border border-[#eadfce] bg-[#fffbf5] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#f97316]">Vet Approval Packet</p>
                  <h3 className="mt-1 font-semibold text-[#2b2118]">Turkey + sweet potato weekly batch</h3>
                </div>
                <span className="rounded-full bg-[#eaf6ea] px-3 py-1 text-xs font-bold text-[#2f8e56]">Example packet</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Dog profile', 'Molly | 42 lb | Adult'],
                  ['Recipe', '14 containers + freezer plan'],
                  ['Daily portion', 'Calculated for your dog'],
                  ['Approval request', 'Approve or request edits'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#eadfce] bg-white p-3">
                    <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[#f97316]">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#2b2118]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-[#2f8e56] sm:grid-cols-2">
                {['Calories and portions', 'Ingredients and exclusions', 'Supplement notes', 'Vet signature field'].map(item => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-2xl bg-[#eaf6ea] px-3 py-2">
                    <Check size={14} aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <DemoVideo />
        </div>
      </section>

      {/* What you can make */}
      <section className="px-4 py-12 bg-[#fff6ec]">
        <div className="mx-auto max-w-5xl">
          <header className="text-center">
            <h2 className="text-3xl font-bold text-[#2b2118]">What you can make</h2>
            <p className="mt-2 text-[#7f7469]">60+ safety-checked templates across every recipe type.</p>
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
          <h2 className="text-3xl font-bold text-[#2b2118]">Start with a treat. Stay for mealtime.</h2>
          <p className="mt-2 text-[#7f7469]">
            Non-subscribers get exactly one free treat recipe. Full meals, weekly batches,
            toppers, pantry food recipes, and vet packets require a paid plan.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
            <div className="rounded-3xl border border-[#eadfce] bg-white p-6 text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">Free</p>
              <p className="mt-3 text-4xl font-bold text-[#2b2118]">1 treat</p>
              <p className="mt-2 text-sm text-[#5f564d]">One complete treat recipe to try with a free account.</p>
            </div>
            <div className="rounded-3xl border border-[#eadfce] bg-white p-6 text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">Monthly</p>
              <p className="mt-3 text-4xl font-bold text-[#2b2118]">$8<span className="text-base font-medium text-[#7f7469]">/mo</span></p>
              <p className="mt-2 text-sm text-[#5f564d]">unlocks homemade food recipes and weekly batches</p>
            </div>
            <div className="rounded-3xl border-2 border-[#f97316] bg-white p-6 text-left shadow-[0_8px_24px_-12px_rgba(249,115,22,0.4)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">Yearly</p>
                <span className="rounded-full bg-[#fff0de] px-2.5 py-1 text-xs font-semibold text-[#f97316]">Save 38%</span>
              </div>
              <p className="mt-3 text-4xl font-bold text-[#2b2118]">$59<span className="text-base font-medium text-[#7f7469]">/yr</span></p>
              <p className="mt-2 text-sm text-[#43a365]">best value for paid food recipes and vet packets</p>
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
          <p className="mt-3 text-[#5f564d]">Try the free treat recipe first, then subscribe for homemade meals and weekly batches.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
          >
            Get started — try one free treat recipe
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      </main>
      {/* Footer */}
      <footer className="px-4 py-10 bg-[#2b2118] text-[#cbb9a3]">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white">
                <img src="/cheffo-doggo-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
                <span className="whitespace-nowrap text-base sm:text-lg font-bold tracking-tight">Cheffo Doggo</span>
              </div>
              <p className="mt-3 text-sm max-w-sm">
                Real food first. Supplements only when food can't get there.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
              <Link to="/pricing" className="hover:text-white">Pricing</Link>
              <Link to="/calculator" className="hover:text-white">Calculator</Link>
              <a href="/learn/" className="hover:text-white">Learn</a>
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
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfce] bg-[#fffbf5]/95 p-3 shadow-[0_-8px_24px_rgba(43,33,24,0.12)] backdrop-blur-sm sm:hidden">
        <div className="mx-auto max-w-md">
          <a href="#free-treat" className="flex min-h-11 items-center justify-center rounded-full bg-[#bd4a0b] px-3 text-sm font-semibold text-white shadow-sm">Try a free treat recipe</a>
        </div>
      </div>
    </div>
  );
}

