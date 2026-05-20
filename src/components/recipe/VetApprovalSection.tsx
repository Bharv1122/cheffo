import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  listApprovalsForRecipe,
  requestVetApproval,
  type ApprovalSummary,
  type RequestApprovalResult,
} from '../../lib/approvals';
import { isSupabaseConfigured } from '../../lib/supabase';

interface Props {
  recipeId: string;
}

function describeApproval(approval: ApprovalSummary): { tone: 'good' | 'warn' | 'bad' | 'neutral'; line: string } {
  const vet = approval.vetName ? `Dr. ${approval.vetName} DVM` : approval.vetEmail;
  if (approval.status === 'approved') {
    return { tone: 'good', line: `Approved by ${vet}` };
  }
  if (approval.status === 'approved_with_notes') {
    return { tone: 'good', line: `Approved with notes by ${vet}` };
  }
  if (approval.status === 'declined') {
    return { tone: 'bad', line: `${vet} did not recommend this recipe` };
  }
  if (approval.status === 'expired') {
    return { tone: 'warn', line: `Approval request to ${approval.vetEmail} expired` };
  }
  return { tone: 'neutral', line: `Awaiting review from ${approval.vetEmail}` };
}

export function VetApprovalSection({ recipeId }: Props) {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [vetEmail, setVetEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RequestApprovalResult | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listApprovalsForRecipe(recipeId);
      setApprovals(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load approvals.');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSubmit = useCallback(async () => {
    if (!vetEmail.trim()) {
      setSubmitError('Please enter your vet\'s email.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await requestVetApproval({ recipeId, vetEmail: vetEmail.trim() });
      setLastResult(result);
      setVetEmail('');
      setRequestOpen(false);
      await refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  }, [vetEmail, recipeId, refresh]);

  if (!isSupabaseConfigured) {
    return null;
  }

  const visibleApprovals = approvals.slice(0, 3);

  return (
    <section className="mt-4 doggo-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[1.35rem] font-semibold">Vet Approval</h2>
        <span className="rounded-full bg-[#eef8ee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3f7c54]">
          Optional · adds the badge
        </span>
      </div>
      <p className="mt-1 text-sm text-[#7f7469]">
        Get your vet's sign-off in about a minute — they review one page on their phone and tap approve.
      </p>

      {loading && <p className="mt-3 text-xs text-[#9a9186]">Loading approvals…</p>}
      {loadError && <p className="mt-3 text-xs text-red-600">{loadError}</p>}

      {visibleApprovals.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visibleApprovals.map(approval => {
            const summary = describeApproval(approval);
            const palette =
              summary.tone === 'good'
                ? 'border-[#cdebd5] bg-[#f0fbf3] text-[#2f7d4a]'
                : summary.tone === 'warn'
                ? 'border-[#f7d8b6] bg-[#fff6ec] text-[#7c5018]'
                : summary.tone === 'bad'
                ? 'border-[#f4c5c5] bg-[#fdecec] text-[#8a2c2c]'
                : 'border-[#eadfce] bg-[#fff8ef] text-[#6f6459]';
            return (
              <li key={approval.id} className={`rounded-xl border px-3 py-2 ${palette}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    {summary.tone === 'good' && <CheckCircle2 className="h-4 w-4" />}
                    {summary.tone === 'bad' && <ShieldAlert className="h-4 w-4" />}
                    {summary.tone === 'warn' && <ShieldAlert className="h-4 w-4" />}
                    {summary.tone === 'neutral' && <Mail className="h-4 w-4" />}
                    {summary.line}
                  </span>
                  {(approval.vetPractice || approval.vetState) && (
                    <span className="text-xs font-normal opacity-80">
                      {[approval.vetPractice, approval.vetState].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
                {approval.notes && <p className="mt-1 text-xs italic">"{approval.notes}"</p>}
              </li>
            );
          })}
        </ul>
      )}

      {lastResult?.status === 'auto_inherited' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#cdebd5] bg-[#f0fbf3] px-3 py-2 text-sm text-[#2f7d4a]">
          <Sparkles className="h-4 w-4 mt-0.5" />
          <p>
            This recipe is close enough to a prior approval — auto-inherited the badge from{' '}
            {lastResult.approvedBy?.name ? `Dr. ${lastResult.approvedBy.name} DVM` : 'your vet'}.
          </p>
        </div>
      )}

      {lastResult?.status === 'pending' && (
        <div className="mt-3 rounded-xl border border-[#eadfce] bg-[#fff8ef] px-3 py-2 text-sm text-[#6f6459]">
          Request sent. We{lastResult.email?.sent ? ' emailed your vet a' : "'ll deliver a"} one-page approval form.
          {!lastResult.email?.sent && lastResult.approvalLink && (
            <div className="mt-1 text-xs break-all">
              <span className="font-semibold">Preview link (email not configured):</span> {lastResult.approvalLink}
            </div>
          )}
        </div>
      )}

      {!requestOpen && (
        <div className="mt-4">
          <Button
            icon={<Send size={15} />}
            onClick={() => {
              setRequestOpen(true);
              setSubmitError(null);
              setLastResult(null);
            }}
          >
            Request vet approval
          </Button>
        </div>
      )}

      {requestOpen && (
        <div className="mt-4 space-y-3 rounded-2xl border border-[#eadfce] bg-white p-4">
          <Input
            label="Vet's email"
            type="email"
            required
            value={vetEmail}
            onChange={event => setVetEmail(event.target.value)}
            placeholder="vet@yourclinic.com"
            hint="We'll email a one-page approval form. Your vet may charge their normal consultation fee — please ask in advance."
          />
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <div className="flex gap-2">
            <Button variant="primary" loading={submitting} onClick={onSubmit}>
              Send request
            </Button>
            <Button variant="ghost" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
