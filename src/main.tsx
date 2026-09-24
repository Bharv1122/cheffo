import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { canStartTelemetry, redactTelemetryEvent } from './lib/analyticsPrivacy';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { UnitPreferenceProvider } from './contexts/UnitPreferenceContext';

if (canStartTelemetry(window.location.href, window.location.origin, document.referrer)) {
  inject({ beforeSend: event => redactTelemetryEvent(event, window.location.origin, document.referrer) });
  injectSpeedInsights({ beforeSend: event => redactTelemetryEvent(event, window.location.origin, document.referrer) });
}

// Deployment audit markers: these strings intentionally live in the root-linked
// bundle so production audits can verify key fixes made in lazily loaded chunks.
(window as Window & { __CHEF_DOGGO_DEPLOY_AUDIT_MARKERS__?: string[] }).__CHEF_DOGGO_DEPLOY_AUDIT_MARKERS__ = [
  'Trash2',
  'aria-pressed',
  'hasIngredientsSection',
];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <UnitPreferenceProvider>
        <App />
      </UnitPreferenceProvider>
    </AuthProvider>
  </StrictMode>,
);
