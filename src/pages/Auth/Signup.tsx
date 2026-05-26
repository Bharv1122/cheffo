import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';

export default function SignupPage() {
  const { signUp, isAuthenticated, isSupabaseEnabled } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setError('Use at least 8 characters for better security.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const { error: signUpError, needsEmailVerification } = await signUp(email.trim(), password);

    if (signUpError) {
      setError(signUpError);
      setLoading(false);
      return;
    }

    setLoading(false);
    if (needsEmailVerification) {
      setMessage('Account created! Please check your email to verify your account before logging in.');
    } else {
      setMessage('Account created! You can now start using Cheffo Doggo.');
    }
  }

  return (
    <AuthLayout
      title="Create your Cheffo Doggo account"
      subtitle="Save your dogs, sync recipes across devices, and keep everything in one secure place."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">
            Log in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          type="email"
          label="Email"
          placeholder="you@doggo.com"
          icon={<Mail size={16} />}
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
        />

        <Input
          type="password"
          label="Password"
          placeholder="At least 8 characters"
          icon={<KeyRound size={16} />}
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          hint="Tip: use a unique password you do not reuse elsewhere."
        />

        <Input
          type="password"
          label="Confirm password"
          placeholder="Re-enter your password"
          icon={<KeyRound size={16} />}
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          required
        />

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

        {!isSupabaseEnabled && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Supabase is not configured yet. Add env vars before creating an account.
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={loading} disabled={!isSupabaseEnabled}>
          Create Account
        </Button>

        <p className="text-center text-xs text-[#78716C]">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">Privacy Policy</Link>.
        </p>

        <p className="rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-xs leading-relaxed text-[#78716C]">
          {SHORT_VET_DISCLAIMER}
        </p>
      </form>
    </AuthLayout>
  );
}
