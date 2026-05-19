import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#fffbf5] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
        <section className="doggo-soft-card relative overflow-hidden p-8">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffe8cf] blur-3xl" />
          <div className="relative">
            <Link to="/" className="inline-flex">
              <Logo size="lg" />
            </Link>
            <p className="mt-2 text-sm text-[#8b8378]">Homemade Dog Food Made Simple.</p>

            <h1 className="mt-8 text-3xl font-semibold leading-tight text-[#2b2118] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-md text-base text-[#7d7268]">{subtitle}</p>

            <div className="mt-8 rounded-3xl border border-[#eadfce] bg-white/80 p-4">
              <img
                src="/chef-doggo-logo.webp"
                alt="Cheffo Doggo mascot"
                className="mx-auto h-44 w-44 object-contain sm:h-52 sm:w-52"
              />
              <p className="mt-2 text-center text-sm text-[#7f7469]">
                Trusted recipe guidance for every paw-step.
              </p>
            </div>
          </div>
        </section>

        <section className="doggo-card p-6 sm:p-8">
          {children}
          {footer && <div className="mt-6 border-t border-[#eadfce] pt-4 text-sm text-[#7d7268]">{footer}</div>}
        </section>
      </div>
    </div>
  );
}
