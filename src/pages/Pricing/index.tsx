import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Sparkles, ShieldCheck, ChefHat, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { supabase } from '../../lib/supabase';

type Plan = 'monthly' | 'yearly';

const FEATURES: { icon: React.ReactNode; text: string }[] = [
  { icon: <ChefHat size={16} />, text: 'Unlimited personalized full-meal & batch recipes' },
  { icon: <Sparkles size={16} />, text: 'AI ingredient swaps and pantry-mode generation' },
  { icon: <MessageCircle size={16} />, text: 'Ask Cheffo Doggo — your AI canine-nutrition assistant' },
  { icon: <ShieldCheck size={16} />, text: 'Vet Export PDFs + distributed vet-approval flow' },
];

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wasCanceled = searchParams.get('canceled') === '1';

  // If the user already has premium, redirect them to Settings — no point
  // showing pricing to someone already paying.
  useEffect(() => {
    if (isPremium) navigate('/settings', { replace: true });
  }, [isPremium, navigate]);

  async function startCheckout(plan: Plan) {
    if (!isAuthenticated) {
      navigate(`/signup?redirect=/pricing`);
      return;
    }
    setSubmitting(plan);
    setError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Could not start checkout.' }));
        throw new Error(err.error ?? 'Could not start checkout.');
      }
      const { url } = (await response.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.');
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#fffbf5] py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#7f7469] hover:text-[#2b2118]">
          <ArrowLeft size={14} /> Back
        </Link>

        <header className="mt-6 text-center">
          <h1 className="text-3xl font-bold text-[#2b2118]">Cheffo Doggo Premium</h1>
          <p className="mt-2 text-[#7f7469]">
            Real food first. Supplements only when food can't get there. Vet-informed recipes built for your dog.
          </p>
        </header>

        {wasCanceled && (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Checkout canceled — no charge was made. Subscribe whenever you're ready.
          </p>
        )}
        {error && (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <PricingCard
            label="Monthly"
            price="$8"
            cadence="/month"
            cta="Subscribe monthly"
            ctaLoading={submitting === 'monthly'}
            ctaDisabled={submitting !== null}
            onCta={() => startCheckout('monthly')}
          />
          <PricingCard
            label="Yearly"
            price="$59"
            cadence="/year"
            savingsNote="≈ $4.92/mo — save 38%"
            highlighted
            cta="Subscribe yearly"
            ctaLoading={submitting === 'yearly'}
            ctaDisabled={submitting !== null}
            onCta={() => startCheckout('yearly')}
          />
        </div>

        <section className="mt-8 doggo-card p-6">
          <h2 className="text-base font-semibold text-[#2b2118]">Premium unlocks</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#3a302a]">
            {FEATURES.map(f => (
              <li key={f.text} className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fff0de] text-[#f97316]">
                  {f.icon}
                </span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-xs text-[#78716C]">
            <strong className="font-semibold text-[#3a302a]">14-day money-back guarantee.</strong>{' '}
            Try Cheffo Doggo Premium and if it's not for you and your dog, email us within 14 days for a full refund. No-questions-asked.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-[#9c9288]">
          Signed in as {user?.email ?? 'guest'}. Subscriptions renew automatically; cancel anytime from Settings.
        </p>
      </div>
    </div>
  );
}

interface PricingCardProps {
  label: string;
  price: string;
  cadence: string;
  savingsNote?: string;
  highlighted?: boolean;
  cta: string;
  ctaLoading: boolean;
  ctaDisabled: boolean;
  onCta: () => void;
}

function PricingCard({
  label,
  price,
  cadence,
  savingsNote,
  highlighted = false,
  cta,
  ctaLoading,
  ctaDisabled,
  onCta,
}: PricingCardProps) {
  return (
    <div
      className={[
        'doggo-card p-6',
        highlighted ? 'border-2 border-[#f97316] shadow-[0_8px_24px_-12px_rgba(249,115,22,0.4)]' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#7f7469]">{label}</p>
        {highlighted && (
          <span className="rounded-full bg-[#fff0de] px-2.5 py-1 text-xs font-semibold text-[#f97316]">
            Best value
          </span>
        )}
      </div>
      <p className="mt-3 text-4xl font-bold text-[#2b2118]">
        {price}
        <span className="ml-1 text-base font-medium text-[#7f7469]">{cadence}</span>
      </p>
      {savingsNote && <p className="mt-1 text-sm text-[#43a365]">{savingsNote}</p>}
      <Button
        className="mt-5 w-full"
        size="lg"
        loading={ctaLoading}
        disabled={ctaDisabled}
        onClick={onCta}
      >
        {cta}
      </Button>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[#7f7469]">
        <Check size={12} className="text-[#43a365]" /> 14-day money-back guarantee
      </p>
    </div>
  );
}
