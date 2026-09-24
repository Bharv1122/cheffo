import { Fragment, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdultConfirmationGate } from './AdultConfirmationGate';

// Reset account-owned hooks immediately on an identity change. Keep this inside
// BrowserRouter so an in-flight sign-in callback can still navigate afterward.
export function AccountScope({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <Fragment key={user?.id ?? 'signed-out'}>{children}<AdultConfirmationGate /></Fragment>;
}
