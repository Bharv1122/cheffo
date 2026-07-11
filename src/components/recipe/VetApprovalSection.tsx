import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Mail, Pencil, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  listApprovalsForRecipe,
  requestVetApproval,
  type ApprovalSummary,
  type RequestApprovalResult,
} from '../../lib/approvals';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { SupplementItem } from '../../types/recipe';

interface Props {
  recipeId: string;
  // Supplements on this recipe — surfaced as an opt-in picker in the
  // request form so the user only sends the ones they care about
  // reviewing. Required supplements are always included. (CHE-127)
  supplements?: SupplementItem[];
  // Reports how many approval requests exist for this recipe (any status),
  // so the recipe page can show a "send to your vet" callout only when the
  // user has never started the flow.
  onLoaded?: (approvalCount: number) => void;
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

export function VetApprovalSection({ recipeId, supplements, onLoaded }: Props) {
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [vetEmail, setVetEmail] = useState('');
  // Names of optional supplements the user wants included in the vet's
  // review. Required ones are always included server-side. Defaults to all
  // optional supplements checked. (CHE-127)
  const [includedOptionalNames, setIncludedOptionalNames] = useState<Set<string>>(
    () => new Set((supplements ?? []).filter((s) => !s.isRequired).map((s) => s.name))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RequestApprovalResult | null>(null);

  // Re-sync the default picker selection when the recipe's supplement list
  // changes underneath us (e.g. a vet edit replaced the supplements).
  useEffect(() => {
    setIncludedOptionalNames(
      new Set((supplements ?? []).filter((s) => !s.isRequired).map((s) => s.name))
    );
  }, [supplements]);

  const requiredSupplements = (supplements ?? []).filter((s) => s.isRequired);
  const optionalSupplements = (supplements ?? []).filter((s) => !s.isRequired);
  const toggleOptional = (name: string) => {
    setIncludedOptionalNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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
      onLoaded?.(rows.length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load approvals.');
    } finally {
      setLoading(false);
    }
  }, [recipeId, onLoaded]);

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
      // Send the picked optional names + every required name. The server
      // re-enforces the required set, but being explicit keeps the snapshot
      // unambiguous if the server-side rule ever changes. (CHE-127)
      const supplementNames = supplements
        ? [
            ...requiredSupplements.map((s) => s.name),
            ...optionalSupplements.filter((s) => includedOptionalNames.has(s.name)).map((s) => s.name),
          ]
        : undefined;
      const result = await requestVetApproval({
        recipeId,
        vetEmail: vetEmail.trim(),
        supplementNames,
      });
      setLastResult(result);
      setVetEmail('');
      setRequestOpen(false);
      await refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not send request.');
    } finally {
      setSubmitting(false);
    }
  }, [vetEmail, recipeId, refresh, supplements, requiredSupplements, optionalSupplements, includedOptionalNames]);

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
                {approval.recipeUpdatedByVet && (
                  <p className="mt-1 text-xs flex items-center gap-1">
                    <Pencil size={11} />
                    <span>
                      Recipe updated by {approval.vetName ? `Dr. ${approval.vetName} DVM` : approval.vetEmail}
                      {approval.submittedAt && (
                        <span className="opacity-75"> on {new Date(approval.submittedAt).toLocaleDateString()}</span>
                      )}
                    </span>
                  </p>
                )}
                {approval.notes && <p className="mt-1 text-xs italic">"{approval.notes}"</p>}
                {approval.supplementDoses && approval.supplementDoses.length > 0 && (
                  <div className="mt-2 text-xs">
                    <div className="font-semibold mb-0.5">Vet's recommended supplement doses:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {approval.supplementDoses.map((dose) => (
                        <li key={dose.supplementName}>
                          <span className="opacity-80">{dose.supplementName}:</span> {dose.doseText}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
          {optionalSupplements.length > 0 && (
            <fieldset className="rounded-xl border border-[#eadfce] bg-[#fffaf2] p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[#7c5018]">
                Supplements to review
              </legend>
              {requiredSupplements.length > 0 && (
                <p className="text-xs text-[#7f7469] mb-2">
                  Always included: {requiredSupplements.map((s) => s.name).join(', ')}
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                {optionalSupplements.map((s) => {
                  const checked = includedOptionalNames.has(s.name);
                  return (
                    <label
                      key={s.name}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 cursor-pointer transition-colors',
                        checked
                          ? 'border-[#f97316] bg-[#fff1df] text-[#a16b38]'
                          : 'border-[#eadfce] bg-white text-[#7f7469] hover:bg-[#fff8ef]',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3 accent-[#f97316]"
                        checked={checked}
                        onChange={() => toggleOptional(s.name)}
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#9c9288]">
                Uncheck any optional supplements you don't use — your vet won't see those.
              </p>
            </fieldset>
          )}
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

      {/* Fallback path for vets who prefer paper / their own email client.
          Moved here from the recipe header. (CHE-124) */}
      <div className="mt-4 border-t border-[#eadfce] pt-3 text-xs text-[#7f7469]">
        <Link
          to={`/vet-export/${recipeId}`}
          className="inline-flex items-center gap-1.5 text-[#f97316] hover:underline"
        >
          <FileText size={13} />
          Print a vet-review PDF instead →
        </Link>
      </div>
    </section>
  );
}
