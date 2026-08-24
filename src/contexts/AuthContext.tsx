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

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSupabaseEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailVerification: boolean }>;
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
    const { error } = await signInWithEmailPassword(email, password);
    return { error };
  }

  async function signUp(email: string, password: string) {
    // First-touch attribution captured in App (?src= on any URL) — stamped
    // into the auth user's metadata so we can tell which channel signups
    // come from (auth.users.raw_user_meta_data->>'signup_source').
    let signupSource: string | null = null;
    try {
      signupSource = localStorage.getItem('cheffo_src');
    } catch {
      // localStorage unavailable — attribution is best-effort
    }
    const { session: nextSession, error } = await signUpWithEmailPassword(
      email,
      password,
      signupSource ? { signup_source: signupSource } : undefined
    );
    return {
      error,
      needsEmailVerification: !nextSession,
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
