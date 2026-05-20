// Shared token helpers for the vet-approval API routes (CHE-21).
//
// We hand vets a single-use opaque token in their email link. The DB only
// stores the SHA-256 of that token in `approvals.token_hash`, so a leaked DB
// row can't be used to forge an approval link. The raw token is sent to the
// vet (in the email) and to the requesting user once (so the UI can show it).

const TOKEN_BYTES = 32;
const TOKEN_TTL_DAYS = 30;

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function tokenExpiresAt(): string {
  return new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function approvalLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/vet-approve/${token}`;
}
