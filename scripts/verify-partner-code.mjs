import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const offer = read('src/lib/partnerOffer.ts');
assert.match(offer, /code: 'ALEXAN30'/);
assert.match(offer, /slug: 'alexan30'/);
assert.match(offer, /trialDays: 3/);

const route = read('api/partner-offer/redeem.ts');
assert.match(route, /no card required/i);
assert.match(route, /campaign_trial_end/);
assert.doesNotMatch(route, /STRIPE_SECRET_KEY|checkout\/sessions|payment_method/);

const clientGate = read('src/hooks/useSubscription.ts');
const serverGate = read('api/llm.ts');
assert.match(clientGate, /campaignTrialIsActive\(subscription\.campaign_trial_end\)/);
assert.match(serverGate, /campaign_trial_end.*Date\.parse/s);

const signup = read('src/pages/Auth/Signup.tsx');
const pricing = read('src/pages/Pricing/index.tsx');
assert.match(signup, /Campaign code \(optional\)/);
assert.match(pricing, /Have a campaign code\?/);

console.log('ALEXAN30 verification passed: 3-day no-card entitlement is checked on client and server.');
