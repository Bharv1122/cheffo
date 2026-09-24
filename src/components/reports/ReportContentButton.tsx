import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { sendContentReport, type ReportReason, type ReportTarget } from '../../utils/contentReports';

export function ReportContentButton({ target, label = 'Report content' }: { target: ReportTarget; label?: string }) {
  const { user } = useAuth();
  const [opened, setOpened] = useState<{ userId: string; target: ReportTarget } | null>(null);
  const [reason, setReason] = useState<ReportReason>('unsafe');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState('');
  const sending = useRef(false);
  const fieldId = useId();
  const visible = opened !== null && opened.userId === user?.id;

  function open() {
    if (!user) { setError('Sign in online to send a report.'); return; }
    setOpened({ userId: user.id, target: { ...target } });
    setReason('unsafe'); setDetails(''); setError(''); setReportId('');
  }

  async function submit() {
    if (!opened || sending.current || opened.userId !== user?.id) return;
    sending.current = true; setPending(true); setError('');
    try { setReportId(await sendContentReport(opened.target, reason, details, opened.userId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your report. Please try again.'); }
    finally { sending.current = false; setPending(false); }
  }

  return <>
    <button type="button" onClick={open} disabled={pending}
      className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#6f6459] hover:bg-[#fff6ec] focus-visible:outline-2 focus-visible:outline-[#f97316]">
      <Flag size={13} aria-hidden="true" />{label}
    </button>
    {!opened && error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {visible && createPortal(<Modal open onClose={() => { if (!sending.current) setOpened(null); }} title={reportId ? 'Report received' : label} size="sm">
      {reportId ? <div className="space-y-3">
        <p role="status" className="text-sm">Thank you. Your report was saved for the Cheffo team to review.</p>
        <p className="break-all text-xs text-[#78716C]">Reference: {reportId}</p>
        <Button fullWidth onClick={() => setOpened(null)}>Done</Button>
      </div> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <p className="text-sm text-[#6f6459]">
          {opened.target.source === 'chat' ? 'Send this assistant reply' : opened.target.source === 'image' ? 'Send this saved recipe and its image reference' : 'Send this saved recipe'}
          {' '}with your reason, note and account ID for private developer review. Please leave out personal information.
        </p>
        {opened.target.source === 'chat' && opened.target.message.length > 16000 && <p className="text-xs text-[#6f6459]">This long reply will include its first 16,000 characters. Use the note to describe a problem later in the reply.</p>}
        <label htmlFor={`${fieldId}-reason`} className="block text-sm font-medium">Reason</label>
        <select id={`${fieldId}-reason`} value={reason} disabled={pending} onChange={event => setReason(event.target.value as ReportReason)} className="w-full rounded-xl border border-[#eadfce] bg-white p-3 text-sm">
          <option value="unsafe">Unsafe or harmful</option><option value="offensive">Offensive or inappropriate</option>
          <option value="incorrect">Incorrect or misleading</option><option value="other">Something else</option>
        </select>
        <label htmlFor={`${fieldId}-note`} className="block text-sm font-medium">Note (optional)</label>
        <textarea id={`${fieldId}-note`} value={details} maxLength={500} rows={3} disabled={pending} onChange={event => setDetails(event.target.value)} className="w-full rounded-xl border border-[#eadfce] p-3 text-sm" />
        <p className="text-right text-xs text-[#78716C]">{details.length}/500</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" fullWidth loading={pending}>{pending ? 'Sending report…' : 'Send report'}</Button>
      </form>}
    </Modal>, document.body)}
  </>;
}
