// Service-role Supabase client for server-side API routes.
//
// The anon key + RLS handles user-side access from the browser. The vet's
// approval form is unauthenticated (the token IS the auth), so it has to go
// through a server route that uses the service-role key to bypass RLS.
//
// Required Vercel env vars (NOT VITE_ prefixed):
//   SUPABASE_URL                — same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — from Supabase project settings

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

declare const process: { env: Record<string, string | undefined> };

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase admin env vars missing (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }
  cached = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export function getUserClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase env vars missing (SUPABASE_URL, SUPABASE_ANON_KEY)');
  }
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
