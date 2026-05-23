// Affiliate / external-store helpers.
//
// TODO(affiliate): when the Instacart affiliate account (CJ Affiliate) is
// approved, wrap the returned URL in the CJ deep-link redirect so referred
// purchases generate commission. Until then this is a plain Instacart search
// — same UX, no commission.

const INSTACART_SEARCH_BASE = 'https://www.instacart.com/store/s';

export function buildInstacartSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query.trim());
  return `${INSTACART_SEARCH_BASE}?k=${encoded}`;
}
