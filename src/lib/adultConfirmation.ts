import { supabase } from './supabase';

export class AdultConfirmationError extends Error {}
type ConfirmationHandler = { userId: string; request: (token: string) => Promise<boolean> };
let handler: ConfirmationHandler | null = null;

export function registerAdultConfirmationHandler(next: ConfirmationHandler): () => void {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export async function confirmAdultAccount(token: string): Promise<void> {
  const response = await fetch('/api/account/confirm-adult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ adult_confirmed: true }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.confirmed !== true) {
    throw new AdultConfirmationError('Could not save your age confirmation. Please try again.');
  }
}

// UI gate is only convenience. Every provider call separately checks fresh
// app_metadata server-side. Neither request bodies nor cached JWT claims grant access.
export async function buildAdultAiHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new AdultConfirmationError('Sign in to use AI features.');
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) throw new AdultConfirmationError('Sign in to use AI features.');
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error || !data.user || data.user.id !== session.user.id) {
    throw new AdultConfirmationError('Please sign in again before using AI features.');
  }
  if (data.user.app_metadata?.cheffo_adult_confirmed !== true) {
    if (!handler || handler.userId !== data.user.id || !await handler.request(session.access_token)) {
      throw new AdultConfirmationError('AI features require confirmation that you are at least 18. Your saved recipes and other account tools remain available.');
    }
  }
  // A dialog may stay open across sign-out. Never resume it using another account.
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user.id !== session.user.id) {
    throw new AdultConfirmationError('Your account changed. Please try again.');
  }
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${current.session.access_token}` };
}
