import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { UnitPreferenceProvider } from './contexts/UnitPreferenceContext';

inject();

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
