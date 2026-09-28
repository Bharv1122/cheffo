// Shared by structured chat extraction and the plain-text fallback. Never
// interpret a recognized larger unit (or a grouped number) as bare grams.
const QUANTITY = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\s*[¼½¾]|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)`;
const UNIT = String.raw`(?:kilograms?|kg|grams?|g|ounces?|oz|pounds?|lbs?|cups?|tablespoons?|tbsp|teaspoons?|tsp)`;
export const INGREDIENT_AMOUNT_RE = new RegExp(`(?<![\\d.,/−-])(${QUANTITY})\\s*(${UNIT})\\b`, 'i');
const COMPLETE_AMOUNT_RE = new RegExp(`^(${QUANTITY})\\s*(${UNIT})?$`, 'i');

function quantityNumber(value: string): number {
  const normalized = value.replace(/,/g, '').trim();
  const fraction = normalized.match(/^(\d*)\s*([¼½¾])$/);
  if (fraction) return Number(fraction[1] || 0) + ({ '¼': 0.25, '½': 0.5, '¾': 0.75 }[fraction[2]] ?? 0);
  const ratio = normalized.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (ratio) return Number(ratio[1] || 0) + Number(ratio[2]) / Number(ratio[3]);
  return Number(normalized);
}

export function coerceGrams(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && Math.round(value) > 0 ? Math.round(value) : null;
  }
  if (typeof value !== 'string') return null;
  const match = value.trim().match(COMPLETE_AMOUNT_RE);
  if (!match) return null;
  const quantity = quantityNumber(match[1]);
  const unit = (match[2] || 'g').toLowerCase();
  // Preserve the existing approximate kitchen-volume conversions here.
  const multiplier = /^(kg|kilogram)/.test(unit) ? 1000
    : /^(oz|ounce)/.test(unit) ? 28
    : /^(lb|pound)/.test(unit) ? 454
    : /^cup/.test(unit) ? 200
    : /^(tbsp|tablespoon)/.test(unit) ? 15
    : /^(tsp|teaspoon)/.test(unit) ? 5 : 1;
  const grams = Math.round(quantity * multiplier);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}
