// Stripe helpers for the webhook handler and (future) checkout endpoint.
// Edge-runtime friendly — no Node-specific APIs, no Stripe SDK in the bundle.
// Signature verification is done manually using the Web Crypto API.
//
// Stripe sends webhooks signed as:
//   Stripe-Signature: t=<unix_ts>,v1=<hmac_hex>[,v1=<hmac_hex>...]
// The signed payload is `<unix_ts>.<raw_body>`; the HMAC is SHA-256 keyed
// with the webhook signing secret (whsec_…). See:
// https://docs.stripe.com/webhooks#verify-manually

declare const process: { env: Record<string, string | undefined> };

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const DEFAULT_TOLERANCE_SECONDS = 300; // Stripe's recommended default

export interface StripeSubscriptionItem {
  price: { id: string };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: { data: StripeSubscriptionItem[] };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_end: number | null;
}

export interface StripeCustomer {
  id: string;
  email: string | null;
  metadata: { user_id?: string };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeSignatureError';
  }
}

// Parse Stripe-Signature header into { timestamp, signatures }.
function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    if (key.trim() === 't') {
      timestamp = parseInt(value, 10);
    } else if (key.trim() === 'v1') {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
}

// Constant-time comparison of two hex strings of equal length.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Compute HMAC-SHA256(secret, message) → lowercase hex.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify the Stripe-Signature header against the raw body. Throws on failure.
// Returns the parsed event on success.
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  tolerance: number = DEFAULT_TOLERANCE_SECONDS
): Promise<StripeEvent> {
  if (!signatureHeader) {
    throw new StripeSignatureError('Missing Stripe-Signature header');
  }
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (timestamp < 0 || signatures.length === 0) {
    throw new StripeSignatureError('Malformed Stripe-Signature header');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) {
    throw new StripeSignatureError('Webhook timestamp outside tolerance');
  }

  const expectedSig = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const matches = signatures.some(sig => timingSafeEqualHex(sig, expectedSig));
  if (!matches) {
    throw new StripeSignatureError('Webhook signature mismatch');
  }

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    throw new StripeSignatureError('Webhook body is not valid JSON');
  }
}

// Fetch a Stripe Customer by ID. Used by the webhook handler to look up
// metadata.user_id on the first event for a customer (subsequent events
// re-use the customer_id → user_id mapping already in `subscriptions`).
export async function fetchStripeCustomer(customerId: string): Promise<StripeCustomer> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured');

  const response = await fetch(`${STRIPE_API_BASE}/customers/${encodeURIComponent(customerId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Stripe customers.retrieve failed (${response.status}): ${errText}`);
  }
  return (await response.json()) as StripeCustomer;
}
