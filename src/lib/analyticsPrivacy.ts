// Telemetry needs screen names, never approval tokens, record IDs or auth URLs.
const SCREENS = new Set([
  '/', '/login', '/signup', '/privacy', '/terms', '/pricing', '/help', '/calculator',
  '/profiles', '/profiles/new', '/recipes', '/bowl-builder', '/pantry', '/treats',
  '/assistant', '/settings',
]);
const SOURCES = new Set(['card', 'fb', 'guest-treat', 'calculator', 'mobile-sticky']);

export function telemetryPath(pathname: string): string | null {
  return SCREENS.has(pathname) ? pathname : null;
}

export function telemetrySource(source: string | null): string | null {
  return source && SOURCES.has(source) ? source : null;
}

function safeUrl(raw: string, origin: string): URL | null {
  try {
    const url = new URL(raw, origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin || url.username || url.password || url.hash || !telemetryPath(url.pathname)) return null;
    for (const [name, value] of url.searchParams) {
      if (name === 'src' && telemetrySource(value)) continue;
      if (name === 'distribution' && value === 'google-play') continue;
      return null;
    }
    return url;
  } catch { return null; }
}

// The SDKs' supported callback cannot reliably rewrite their separate referrer
// field. Drop telemetry when that document-level value could carry private data.
function safeReferrer(referrer: string, origin: string): boolean {
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return false;
    return url.origin === origin ? telemetryPath(url.pathname) !== null : url.pathname === '/';
  } catch { return false; }
}

export function canStartTelemetry(url: string, origin: string, referrer: string): boolean {
  return Boolean(safeUrl(url, origin)) && safeReferrer(referrer, origin);
}

export function redactTelemetryEvent<T extends { url: string; route?: string }>(
  event: T, origin: string, referrer: string,
): T | null {
  const url = safeUrl(event.url, origin);
  if (!url || !safeReferrer(referrer, origin)) return null;
  if (event.route && !telemetryPath(event.route)) return null;
  return { ...event, url: `${origin}${url.pathname}`, ...(event.route ? { route: url.pathname } : {}) };
}
