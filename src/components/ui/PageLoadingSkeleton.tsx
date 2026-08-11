import React from 'react';

interface Props {
  label?: string;
  cards?: number;
}

export function PageLoadingSkeleton({ label = 'Loading your data', cards = 3 }: Props) {
  return (
    <section className="doggo-card p-5" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="animate-pulse">
        <div className="h-7 w-48 rounded-lg bg-[#f1e7da]" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-[#f6eee4]" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className="rounded-2xl border border-[#eadfce] bg-white p-4">
              <div className="h-32 rounded-xl bg-[#fff1e3]" />
              <div className="mt-3 h-5 w-2/3 rounded bg-[#f1e7da]" />
              <div className="mt-2 h-4 rounded bg-[#f7f0e8]" />
              <div className="mt-2 h-4 w-4/5 rounded bg-[#f7f0e8]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
