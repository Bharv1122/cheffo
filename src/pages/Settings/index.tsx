import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Trash2, AlertTriangle, Mail, Sparkles, CreditCard, Star, HelpCircle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { supabase } from '../../lib/supabase';

const SUPPORT_EMAIL = 'support@cheffodoggo.com';

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { statusLabel: subscriptionStatusLabel, isPremium, refresh: refreshSubscription } = useSubscription();
  const [searchParams] = useSearchParams();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // After a successful Stripe Checkout the user lands back with ?upgrade=success.
  // The webhook should already have written into subscriptions — refresh the
  // hook so the page shows "Active" immediately instead of waiting on the
  // next mount.
  const justUpgraded = searchParams.get('upgrade') === 'success';
  useEffect(() => {
    if (justUpgraded) void refreshSubscription();
  }, [justUpgraded, refreshSubscription]);

  async function handleOpenBillingPortal() {
    setOpeningPortal(true);
    setPortalError(null);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: await buildAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Could not open billing portal.' }));
        throw new Error(err.error ?? 'Could not open billing portal.');
      }
      const { url } = (await response.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Could not open billing portal.');
      setOpeningPortal(false);
    }
  }

  const userEmail = user?.email ?? '';
  const userEmailLower = userEmail.toLowerCase();
  const confirmMatches = deleteConfirmEmail.trim().toLowerCase() === userEmailLower && userEmailLower.length > 0;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/api/account/export', {
        method: 'POST',
        headers: await buildAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Could not export your data.' }));
        throw new Error(err.error ?? 'Could not export your data.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? `cheffo-doggo-data-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export your data.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirmMatches) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: await buildAuthHeaders(),
        body: JSON.stringify({ confirm: userEmail }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Could not delete your account.' }));
        throw new Error(err.error ?? 'Could not delete your account.');
      }
      // Account is gone — sign out the local session and bounce to login.
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.');
      setDeleting(false);
    }
  }

  return (
    <AppShell active="settings">
      <div className="space-y-5 max-w-2xl">
        <header className="doggo-card p-5">
          <h1 className="text-xl font-semibold text-[#2b2118]">Settings</h1>
          <p className="mt-1 text-sm text-[#6f6459]">Manage your account, your data, and your privacy.</p>
        </header>

        <section className="doggo-card p-5">
          <h2 className="text-base font-semibold text-[#2b2118]">Account</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
            <dt className="text-sm text-[#8b8378]">Email</dt>
            <dd className="text-sm font-medium text-[#2b2118]">{userEmail || 'Not signed in'}</dd>
            <dt className="text-sm text-[#8b8378]">Plan</dt>
            <dd className="text-sm font-medium text-[#2b2118] flex items-center gap-1.5">
              {isPremium && <Sparkles size={14} className="text-[#f97316]" aria-hidden="true" />}
              {subscriptionStatusLabel}
            </dd>
            <dt className="text-sm text-[#8b8378]">User ID</dt>
            <dd className="text-xs font-mono text-[#6f6459] break-all">{user?.id ?? '—'}</dd>
          </dl>
        </section>

        <section className="doggo-card p-5">
          <h2 className="text-base font-semibold text-[#2b2118]">Subscription</h2>
          {justUpgraded && (
            <p className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              You're in — welcome to Cheffo Doggo Premium 🎉
            </p>
          )}
          {portalError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {portalError}
            </p>
          )}
          {isPremium ? (
            <>
              <p className="mt-1 text-sm text-[#6f6459]">
                You're on Cheffo Doggo Premium. Update payment method, view invoices, or cancel anytime.
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                icon={<CreditCard size={16} />}
                loading={openingPortal}
                onClick={handleOpenBillingPortal}
              >
                Manage subscription
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#6f6459]">
                Unlock unlimited personalized recipes, Ask Cheffo Doggo, and the vet-approval flow.
                $8/mo or $59/yr · 14-day money-back guarantee.
              </p>
              <Button
                className="mt-4"
                icon={<Star size={16} />}
                onClick={() => navigate('/pricing')}
              >
                Upgrade to Premium
              </Button>
            </>
          )}
        </section>

        <section className="doggo-card p-5">
          <h2 className="text-base font-semibold text-[#2b2118]">Help & support</h2>
          <p className="mt-1 text-sm text-[#6f6459]">
            Check the FAQ for common questions, or email us directly. We read every message.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/help')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#eadfce] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b2118] shadow-sm transition-colors hover:bg-[#fff6ec]"
            >
              <HelpCircle size={16} aria-hidden="true" />
              Browse help center
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Cheffo Doggo feedback')}&body=${encodeURIComponent(
                `\n\n---\nUser: ${userEmail || '(not signed in)'}\nUser ID: ${user?.id ?? '—'}`
              )}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#eadfce] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b2118] shadow-sm transition-colors hover:bg-[#fff6ec]"
            >
              <Mail size={16} aria-hidden="true" />
              Email {SUPPORT_EMAIL}
            </a>
          </div>
        </section>

        <section className="doggo-card p-5">
          <h2 className="text-base font-semibold text-[#2b2118]">Your data</h2>
          <p className="mt-1 text-sm text-[#6f6459]">
            Download everything Cheffo Doggo has stored on your behalf — your dog profiles, saved recipes,
            preferences, vet-approval history. Plain JSON, all yours.
          </p>
          {exportError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportError}
            </p>
          )}
          <Button
            className="mt-4"
            variant="secondary"
            icon={<Download size={16} />}
            loading={exporting}
            onClick={handleExport}
          >
            Download my data
          </Button>
        </section>

        <section className="doggo-card p-5 border-red-200">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-red-700">Delete account</h2>
              <p className="mt-1 text-sm text-[#6f6459]">
                Permanently delete your Cheffo Doggo account and every row of data we hold for you.
                This cannot be undone — if you want a copy first, download your data above.
              </p>
              <Button
                className="mt-4"
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  setDeleteConfirmEmail('');
                  setDeleteError(null);
                  setDeleteModalOpen(true);
                }}
                disabled={!userEmail}
              >
                Delete my account
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => {
          if (!deleting) setDeleteModalOpen(false);
        }}
        title="Delete your account?"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              loading={deleting}
              disabled={!confirmMatches}
              onClick={handleDelete}
            >
              Permanently delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[#2b2118]">
          This permanently removes your Cheffo Doggo account, your dog profiles, your saved recipes,
          your vet-approval history, and your login. <strong>It cannot be undone.</strong>
        </p>
        <p className="mt-3 text-sm text-[#6f6459]">
          To confirm, type your email exactly: <span className="font-semibold text-[#2b2118]">{userEmail}</span>
        </p>
        <div className="mt-3">
          <Input
            type="email"
            label="Email to confirm deletion"
            placeholder={userEmail}
            value={deleteConfirmEmail}
            onChange={event => setDeleteConfirmEmail(event.target.value)}
            autoComplete="off"
            disabled={deleting}
          />
        </div>
        {deleteError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteError}
          </p>
        )}
      </Modal>
    </AppShell>
  );
}
