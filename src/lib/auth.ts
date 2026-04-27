import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

function missingConfigResult(message = 'Supabase is not configured.'): AuthResult {
  return { user: null, session: null, error: message };
}

function normalizeAuthErrorMessage(rawMessage?: string | null): string | null {
  if (!rawMessage) {
    return null;
  }

  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
    return 'Too many auth attempts right now. Please wait a minute and try again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please verify your email before logging in.';
  }

  return message;
}

export function getAppOrigin(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin;
}

export function getPasswordResetRedirectUrl(): string {
  const origin = getAppOrigin();
  return origin ? `${origin}/reset-password` : '';
}

export async function signInWithEmailPassword(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    return missingConfigResult();
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return {
    user: data.user,
    session: data.session,
    error: normalizeAuthErrorMessage(error?.message),
  };
}

export async function signUpWithEmailPassword(email: string, password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    return missingConfigResult();
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  return {
    user: data.user,
    session: data.session,
    error: normalizeAuthErrorMessage(error?.message),
  };
}

export async function signOutCurrentUser(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { error } = await supabase.auth.signOut();
  return normalizeAuthErrorMessage(error?.message);
}

export async function sendPasswordResetEmail(email: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return 'Supabase is not configured.';
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  return normalizeAuthErrorMessage(error?.message);
}

export async function updatePassword(password: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return 'Supabase is not configured.';
  }

  const { error } = await supabase.auth.updateUser({ password });
  return normalizeAuthErrorMessage(error?.message);
}
