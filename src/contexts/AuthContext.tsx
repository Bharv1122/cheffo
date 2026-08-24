import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signOutCurrentUser,
  signUpWithEmailPassword,
  updatePassword,
} from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ALEXAN_CAMPAIGN, isAlexanCode } from '../lib/partnerOffer';
import { redeemPartnerCode } from '../lib/partnerRedeem';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSupabaseEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, partnerCode?: string) => Promise<{
    error: string | null;
    needsEmailVerification: boolean;
    partnerOfferApplied: boolean;
    partnerOfferError: string | null;
  }>;
  signOut: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateCurrentPassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Lazy-init: when Supabase isn't configured there's nothing to load, so we
  // start in the not-loading state. This avoids a setState-in-effect on mount.
  const [loading, setLoading] = useState(() => isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error, session: nextSession } = await signInWithEmailPassword(email, password);
    if (!error && nextSession) {
      try {
        const pendingCode = localStorage.getItem('cheffo_pending_partner_code');
        if (pendingCode && isAlexanCode(pendingCode)) {
          const redeemed = await redeemPartnerCode(pendingCode);
          if (redeemed.ok) localStorage.removeItem('cheffo_pending_partner_code');
        }
      } catch {
        // Pending redemption can still be completed from Pricing.
      }
    }
    return { error };
  }

  async function signUp(email: string, password: string, partnerCode = '') {
    // First-touch attribution captured in App (?src= on any URL) — stamped
    // into the auth user's metadata so we can tell which channel signups
    // come from (auth.users.raw_user_meta_data->>'signup_source').
    let signupSource: string | null = null;
    try {
      signupSource = localStorage.getItem('cheffo_src');
    } catch {
      // localStorage unavailable — attribution is best-effort
    }
    const hasPartnerCode = isAlexanCode(partnerCode);
    if (hasPartnerCode) signupSource = ALEXAN_CAMPAIGN.slug;

    const { session: nextSession, error } = await signUpWithEmailPassword(
      email,
      password,
      signupSource ? { signup_source: signupSource } : undefined
    );
    let partnerOfferApplied = false;
    let partnerOfferError: string | null = null;
    if (!error && hasPartnerCode) {
      if (nextSession) {
        const redeemed = await redeemPartnerCode(partnerCode);
        partnerOfferApplied = redeemed.ok;
        partnerOfferError = redeemed.error;
      } else {
        try {
          localStorage.setItem('cheffo_pending_partner_code', ALEXAN_CAMPAIGN.code);
        } catch {
          partnerOfferError = 'After verifying your email, enter ALEXAN30 on the Pricing page.';
        }
      }
    }

    return {
      error,
      needsEmailVerification: !nextSession,
      partnerOfferApplied,
      partnerOfferError,
    };
  }

  async function signOut() {
    const error = await signOutCurrentUser();
    return { error };
  }

  async function resetPassword(email: string) {
    const error = await sendPasswordResetEmail(email);
    return { error };
  }

  async function updateCurrentPassword(password: string) {
    const error = await updatePassword(password);
    return { error };
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: Boolean(user),
      isSupabaseEnabled: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updateCurrentPassword,
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- standard React pattern: pair the Provider with its consumer hook in the same module.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
