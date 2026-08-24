export const ALEXAN_CAMPAIGN = {
  code: 'ALEXAN30',
  slug: 'alexan30',
  trialDays: 3,
} as const;

export function normalizePartnerCode(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

export function isAlexanCode(raw: string | null | undefined): boolean {
  return normalizePartnerCode(raw) === ALEXAN_CAMPAIGN.code;
}

export function campaignTrialIsActive(end: string | null | undefined, now = Date.now()): boolean {
  if (!end) return false;
  const timestamp = Date.parse(end);
  return Number.isFinite(timestamp) && timestamp > now;
}
