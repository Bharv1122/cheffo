import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}

// Shared chrome for /privacy and /terms. Public, marketing-style layout
// (no AppShell) because these pages must be accessible without signing in —
// required by both Apple's and Google's app-store review.
export function LegalLayout({ title, effectiveDate, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-[#fffbf5] py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#7f7469] hover:text-[#2b2118]">
          <ArrowLeft size={14} /> Cheffo Doggo
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold text-[#2b2118]">{title}</h1>
          <p className="mt-2 text-sm text-[#7f7469]">Effective date: {effectiveDate}</p>
        </header>

        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong className="font-semibold">v1 draft — not yet attorney-reviewed.</strong>{' '}
          We recommend a licensed attorney in your jurisdiction review and revise these terms before relying on
          them in a public launch.
        </div>

        <article className="prose mt-8 space-y-6 text-[#2b2118] leading-relaxed">
          {children}
        </article>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-[#eadfce] pt-6 text-sm text-[#7f7469]">
          <Link to="/privacy" className="hover:text-[#2b2118] underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[#2b2118] underline">Terms of Service</Link>
          <Link to="/help" className="hover:text-[#2b2118] underline">Help center</Link>
          <a href="mailto:support@cheffodoggo.com" className="hover:text-[#2b2118] underline">Contact</a>
        </footer>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  id?: string;
}

export function Section({ title, id, children }: SectionProps) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold text-[#2b2118]">{title}</h2>
      <div className="space-y-3 text-sm text-[#3a302a] leading-relaxed">{children}</div>
    </section>
  );
}
