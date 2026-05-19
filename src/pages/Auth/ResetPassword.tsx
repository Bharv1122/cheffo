import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { session, resetPassword, updateCurrentPassword, isSupabaseEnabled } = useAuth();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isRecoveryMode = useMemo(
    () => searchParams.get('type') === 'recovery' || Boolean(session),
    [searchParams, session]
  );

  async function handleSendResetEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const nextError = await resetPassword(email.trim());

    if (nextError.error) {
      setError(nextError.error);
      setLoading(false);
      return;
    }

    setMessage('Password reset email sent. Check your inbox for the secure recovery link.');
    setLoading(false);
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const nextError = await updateCurrentPassword(newPassword);

    if (nextError.error) {
      setError(nextError.error);
      setLoading(false);
      return;
    }

    setMessage('Password updated successfully. You can now log in with your new password.');
    setLoading(false);
  }

  return (
    <AuthLayout
      title={isRecoveryMode ? 'Set a new password' : 'Reset your password'}
      subtitle={
        isRecoveryMode
          ? 'Almost done! Choose a new password to secure your Cheffo Doggo account.'
          : 'Enter your account email and we will send you a secure reset link.'
      }
      footer={
        <p>
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">
            Back to login
          </Link>
        </p>
      }
    >
      {isRecoveryMode ? (
        <form className="space-y-4" onSubmit={handleUpdatePassword}>
          <Input
            type="password"
            label="New password"
            placeholder="At least 8 characters"
            icon={<KeyRound size={16} />}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            required
          />
          <Input
            type="password"
            label="Confirm new password"
            placeholder="Re-enter your new password"
            icon={<KeyRound size={16} />}
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            required
          />

          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

          <Button type="submit" fullWidth size="lg" loading={loading} disabled={!isSupabaseEnabled}>
            Save New Password
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSendResetEmail}>
          <Input
            type="email"
            label="Email"
            placeholder="you@doggo.com"
            icon={<Mail size={16} />}
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />

          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

          {!isSupabaseEnabled && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Supabase is not configured yet. Add env vars before resetting passwords.
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading} disabled={!isSupabaseEnabled}>
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
