import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Calculator as CalculatorIcon,
  Home,
  Menu,
  MessageCircle,
  PawPrint,
  Sparkles,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { Button } from '../ui/Button';
import { FloatingChatHead } from '../chat/FloatingChatHead';
import { useAuth } from '../../contexts/AuthContext';

type MainNavKey = 'home' | 'recipes' | 'dogs' | 'treats' | 'assistant';

interface AppShellProps {
  active: MainNavKey;
  children: React.ReactNode;
  rightRail?: React.ReactNode;
}

const SIDE_ITEMS = [
  { to: '/', label: 'Home', icon: <Home size={21} /> },
  { to: '/recipes', label: 'Recipes', icon: <BookOpen size={21} /> },
  { to: '/profiles', label: 'My Dogs', icon: <PawPrint size={21} /> },
  { to: '/treats', label: 'Treats', icon: <Sparkles size={21} /> },
  { to: '/assistant', label: 'Ask Chef', icon: <MessageCircle size={21} /> },
  { to: '/calculator', label: 'Calculator', icon: <CalculatorIcon size={21} /> },
];

export function AppShell({ active, children, rightRail }: AppShellProps) {
  const navigate = useNavigate();
  const { user, signOut, isSupabaseEnabled } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = user?.email?.split('@')[0] ?? 'Guest';

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function handleMobileNavigate(to: string) {
    setMobileMenuOpen(false);
    navigate(to);
  }

  return (
    <div className="min-h-screen bg-[#fffbf5]">
      <header className="sticky top-0 z-50 border-b border-[#eadfce] bg-[#fffbf5]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-24 w-full max-w-[1440px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#eadfce] bg-white text-[#7f7469] lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <Link to="/" className="min-w-0 shrink">
            <Logo size="md" className="gap-3" />
            <p className="ml-12 -mt-1 hidden text-xs text-[#8b8378] sm:block">Homemade Dog Food Made Simple</p>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button size="sm" icon={<Plus size={16} />} onClick={() => navigate('/wizard')} className="max-md:hidden">
              Start New Bowl
            </Button>
            <button className="hidden h-11 w-11 place-items-center rounded-full border border-[#eadfce] bg-white text-[#7f7469] md:grid">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-[#eadfce] bg-white px-2 py-1.5">
              <img src="/chef-doggo-logo.webp" alt="User" className="h-9 w-9 rounded-full object-cover" />
              <div className="hidden pr-1 sm:block">
                <p className="text-sm font-semibold leading-tight text-[#2b2118]">{displayName}</p>
                <p className="text-xs leading-tight text-[#8b8378]">Dog Parent</p>
              </div>
            </div>
            {isSupabaseEnabled && (
              <Button
                variant="ghost"
                size="sm"
                icon={<LogOut size={15} />}
                onClick={handleSignOut}
                className="max-md:hidden"
              >
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative ml-auto h-full w-[86%] max-w-sm bg-[#fffbf5] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo size="sm" />
              <button
                className="grid h-10 w-10 place-items-center rounded-xl border border-[#eadfce] bg-white text-[#7f7469]"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              {SIDE_ITEMS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleMobileNavigate(item.to)}
                  className={[
                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base transition-colors',
                    (active === 'home' && item.to === '/') ||
                    (active === 'recipes' && item.to === '/recipes') ||
                    (active === 'dogs' && item.to === '/profiles') ||
                    (active === 'treats' && item.to === '/treats') ||
                    (active === 'assistant' && item.to === '/assistant')
                      ? 'bg-[#fff3e5] text-[#f97316]'
                      : 'text-[#5f564d] hover:bg-[#fff8ef] hover:text-[#2b2118]',
                  ].join(' ')}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            <Button className="mt-4 w-full" size="sm" icon={<Plus size={16} />} onClick={() => handleMobileNavigate('/wizard')}>
              Start New Bowl
            </Button>
            {isSupabaseEnabled && (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                size="sm"
                icon={<LogOut size={15} />}
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleSignOut();
                }}
              >
                Logout
              </Button>
            )}
          </aside>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="doggo-card hidden p-3 lg:block">
          <div className="space-y-1">
            {SIDE_ITEMS.map(item => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => [
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-[1.75rem] transition-colors',
                  isActive
                    ? 'bg-[#fff3e5] text-[#f97316]'
                    : 'text-[#5f564d] hover:bg-[#fff8ef] hover:text-[#2b2118]',
                ].join(' ')}
              >
                {item.icon}
                <span className="text-base font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-[#d6ebda] bg-[#f2fbf4] p-4 text-sm text-[#4f8f64]">
            <p className="font-semibold">Always consult your veterinarian</p>
            <p className="mt-2 text-xs leading-relaxed text-[#63846d]">
              Cheffo Doggo provides educational guidance only. For medical conditions, consult a licensed vet.
            </p>
            <button className="mt-3 text-xs font-semibold text-[#2f8e56]">Learn more →</button>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>

        {rightRail && <aside className="hidden min-w-0 space-y-4 xl:block">{rightRail}</aside>}
      </div>

      {/* Floating Cheffo Doggo chat head — hidden on the dedicated Assistant
          page since that page IS the full-screen chat. */}
      {active !== 'assistant' && <FloatingChatHead />}
    </div>
  );
}
