// Presentation policy only. This NEVER grants Premium or changes server auth,
// subscription checks, or RLS. The Android launcher adds distribution=google-play
// to every launch and deep link. Keep the marker across same-tab SPA navigation.
const KEY = 'cheffo:distribution';
let googlePlay = false;
if (typeof window !== 'undefined') {
  const requested = new URLSearchParams(window.location.search).get('distribution') === 'google-play';
  try {
    googlePlay = requested || sessionStorage.getItem(KEY) === 'google-play';
    if (googlePlay) sessionStorage.setItem(KEY, 'google-play');
    // The launch marker is transport metadata. Keep it out of shared links
    // after persisting it, without disturbing OAuth query parameters or hashes.
    if (requested) {
      const url = new URL(window.location.href);
      url.searchParams.delete('distribution');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    googlePlay = requested;
  }
}

export function isGooglePlayApp(): boolean { return googlePlay; }
export const ANDROID_ACCESS_MESSAGE = 'This Android version supports free features and access already included with your account. Purchases and payment changes are not available in the app.';

export function requireWebBilling(): void {
  if (googlePlay) throw new Error('Purchases and payment changes are not available in this Android app.');
}
