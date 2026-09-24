import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { confirmAdultAccount, registerAdultConfirmationHandler } from '../../lib/adultConfirmation';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function AdultConfirmationGate() {
  const { user } = useAuth();
  const pending = useRef<{ token: string; resolve: (value: boolean) => void }[]>([]);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef({ value: 0 });

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const lifecycle = generation.current;
    const requests = pending.current;
    const unregister = registerAdultConfirmationHandler({ userId, request: token => new Promise(resolve => {
      pending.current.push({ token, resolve });
      setOpen(true);
    }) });
    return () => {
      lifecycle.value++;
      unregister();
      requests.splice(0).forEach(request => request.resolve(false));
    };
  }, [userId]);

  function finish(confirmed: boolean) {
    pending.current.splice(0).forEach(request => request.resolve(confirmed));
    setOpen(false); setChecked(false); setError('');
  }
  async function confirm() {
    const request = pending.current[0];
    if (!checked || saving || !request) return;
    const currentGeneration = generation.current.value;
    setSaving(true); setError('');
    try {
      await confirmAdultAccount(request.token);
      if (generation.current.value === currentGeneration) finish(true);
    } catch {
      if (generation.current.value === currentGeneration) setError('Could not save your confirmation. Please try again.');
    } finally {
      if (generation.current.value === currentGeneration) setSaving(false);
    }
  }
  return <Modal open={open} onClose={() => { if (!saving) finish(false); }} title="Before using AI features" size="sm">
    <p className="text-sm text-[#57534e]">Cheffo Doggo is for adults 18 and older. Please confirm your age to continue. This is your own declaration; we do not verify your age or ask for an ID.</p>
    <label className="my-4 flex items-start gap-3 text-sm font-medium">
      <input type="checkbox" checked={checked} disabled={saving} onChange={event => setChecked(event.target.checked)} className="mt-1 h-4 w-4" />
      <span>I confirm that I am at least 18 years old.</span>
    </label>
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    <Button fullWidth disabled={!checked} loading={saving} onClick={() => { void confirm(); }}>Confirm and continue</Button>
    <button type="button" disabled={saving} onClick={() => finish(false)} className="mt-3 w-full text-sm text-[#78716c]">Not now</button>
    <p className="mt-3 text-xs text-[#78716c]">Your saved recipes, settings, and account tools remain available if you do not continue.</p>
  </Modal>;
}
