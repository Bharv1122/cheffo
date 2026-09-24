import { supabase } from '../lib/supabase';

export type ReportTarget = { source: 'recipe' | 'image'; recipeId: string } | { source: 'chat'; message: string };
export type ReportReason = 'unsafe' | 'offensive' | 'incorrect' | 'other';

export async function sendContentReport(target: ReportTarget, reason: ReportReason, details: string, expectedUserId: string): Promise<string> {
  if (!supabase) throw new Error('Sign in online to send a report.');
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session?.access_token || session.user.id !== expectedUserId)
    throw new Error('Your account changed or your session expired. Reopen this report after signing in.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/content-reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...target, ...(target.source === 'chat' ? { message: target.message.slice(0, 16000).replace(/[\uD800-\uDBFF]$/, ''), messageTruncated: target.message.length > 16000 } : {}), reason, details }), signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true || typeof result?.id !== 'string' || !result.id)
      throw new Error(result?.error || 'Your report was not confirmed saved. Please try again.');
    return result.id;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new Error('The connection timed out. We could not confirm your report was saved.', { cause: error });
    if (error instanceof TypeError) throw new Error('Could not connect. Go online and try again.', { cause: error });
    throw error;
  } finally { window.clearTimeout(timeout); }
}
