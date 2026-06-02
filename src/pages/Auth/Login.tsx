import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isAuthenticated, isSupabaseEnabled } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      title="Welcome back, Dog Parent!"
      subtitle="Log in to continue building safe, personalized meals for your pup."
      footer={
        <p>
          New to Cheffo Doggo?{' '}
          <Link to="/signup" className="font-semibold text-[#f97316] hover:text-[#ea6a0c]">
            Create your account
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
          autoComplete="email"
          required
        />

        <Input
          type="password"
          label="Password"
          placeholder="••••••••"
          icon={<KeyRound size={16} />}
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!isSupabaseEnabled && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Supabase is not configured yet. Add env vars before trying to log in.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Link to="/reset-password" className="text-sm font-medium text-[#f97316] hover:text-[#ea6a0c]">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading} disabled={!isSupabaseEnabled}>
          Log In
        </Button>
      </form>
    </AuthLayout>
  );
}
