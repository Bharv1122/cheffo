import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Phone, Search, ShieldCheck } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Disclaimer } from '../../components/ui/Disclaimer';
import {
  ASPCA_POISON_CONTROL,
  SAFETY_LEVEL_LABELS,
  TOXIC_INGREDIENTS,
  type ToxicEntry,
} from '../../data/toxicIngredients';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';

type Level = ToxicEntry['level'];

const LEVEL_ORDER: Level[] = ['hard_block', 'warning', 'info'];

const LEVEL_STYLE: Record<Level, { badge: 'red' | 'amber' | 'green'; hint: string }> = {
  hard_block: { badge: 'red', hint: 'Never feed. Cheffo blocks recipes that include it.' },
  warning: { badge: 'amber', hint: 'Avoid or ask your vet first. Cheffo warns when it appears.' },
  info: { badge: 'green', hint: 'Fine in small amounts for most dogs. Check with your vet.' },
};

const POISON_CONTROL_TEL = `tel:+1${ASPCA_POISON_CONTROL.replace(/\D/g, '')}`;

function displayName(entry: ToxicEntry): string {
  const name = entry.title ?? entry.name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function matches(entry: ToxicEntry, query: string): boolean {
  if (!query) return true;
  return [entry.name, entry.title ?? '', entry.category, ...entry.aliases].some(t => t.toLowerCase().includes(query));
}

function PoisonControlCallout() {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      <Phone size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        If your dog ate this, call your vet or ASPCA Animal Poison Control at{' '}
        <a href={POISON_CONTROL_TEL} className="font-semibold underline">{ASPCA_POISON_CONTROL}</a> right away.
      </span>
    </p>
  );
}

function EntryCard({ entry }: { entry: ToxicEntry }) {
  const [open, setOpen] = useState(false);
  const style = LEVEL_STYLE[entry.level];
  const detailsId = `safety-${entry.name.replace(/\W+/g, '-')}`;
  const hasDetails = Boolean(entry.symptoms?.length || entry.onset || entry.aliases.length);

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#1C1917]">{displayName(entry)}</h3>
            <Badge variant={style.badge}>{SAFETY_LEVEL_LABELS[entry.level]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-[#78716C]">{entry.category}</p>
          <p className="mt-2 text-sm text-[#44403C]">{entry.reason}</p>
        </div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={['mt-1 shrink-0 text-[#78716C] transition-transform', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {open && (
        <div id={detailsId} className="border-t border-[#eadfce] px-4 pb-4 pt-3 text-sm text-[#44403C]">
          {hasDetails && (
            <dl className="space-y-2">
              {entry.aliases.length > 0 && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b8378]">Also known as</dt>
                  <dd>{entry.aliases.join(', ')}</dd>
                </div>
              )}
              {entry.symptoms && entry.symptoms.length > 0 && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b8378]">Signs to watch for</dt>
                  <dd>{entry.symptoms.join(', ')}</dd>
                </div>
              )}
              {entry.onset && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b8378]">Signs can start</dt>
                  <dd>{entry.onset}</dd>
                </div>
              )}
            </dl>
          )}
          {entry.guidance && <p className={hasDetails ? 'mt-3' : ''}>{entry.guidance}</p>}
          {entry.level !== 'info' && (
            <p className="mt-2 text-xs text-[#78716C]">Signs and timing vary by dog and amount. Ask your vet about your dog.</p>
          )}
        </div>
      )}

      {entry.level === 'hard_block' && (
        <div className="px-4 pb-4 -mt-3">
          <PoisonControlCallout />
        </div>
      )}
    </Card>
  );
}

export default function SafetyPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState<'all' | Level>('all');

  const categories = useMemo(
    () => Array.from(new Set(TOXIC_INGREDIENTS.map(e => e.category))).sort(),
    [],
  );

  const q = query.trim().toLowerCase();
  const results = TOXIC_INGREDIENTS
    .filter(e => matches(e, q))
    .filter(e => category === 'all' || e.category === category)
    .filter(e => level === 'all' || e.level === level)
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || displayName(a).localeCompare(displayName(b)));

  const filtered = q !== '' || category !== 'all' || level !== 'all';

  return (
    <>
      <Header title="Ingredient Safety" backTo="/" />
      <PageWrapper>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
            <ShieldCheck size={24} className="text-[#43a365]" />
          </div>
          <div>
            <h2 className="font-bold text-[#1C1917]">Ingredient safety database</h2>
            <p className="mt-0.5 text-sm text-[#78716C]">
              The foods Cheffo Doggo checks every recipe against: what is toxic, what needs caution, and what is safe in moderation.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Disclaimer variant="warning" title="Think your dog ate something toxic?">
            Call your veterinarian or the ASPCA Animal Poison Control Center at{' '}
            <a href={POISON_CONTROL_TEL} className="font-semibold underline">{ASPCA_POISON_CONTROL}</a> right away. Don't wait for
            signs to appear: with many toxins, time matters.
          </Disclaimer>

          <Card>
            <Input
              type="search"
              aria-label="Search ingredients"
              placeholder="Search, e.g. raisins or birch sugar"
              icon={<Search size={16} />}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="safety-level"
                label="Safety level"
                value={level}
                onChange={e => setLevel(e.target.value as 'all' | Level)}
                options={[
                  { value: 'all', label: 'All levels' },
                  ...LEVEL_ORDER.map(l => ({ value: l, label: SAFETY_LEVEL_LABELS[l] })),
                ]}
              />
              <Select
                id="safety-category"
                label="Category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                options={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#78716C]">
              <span aria-live="polite">
                Showing {results.length} of {TOXIC_INGREDIENTS.length}
              </span>
              {filtered && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setCategory('all'); setLevel('all'); }}
                  className="font-semibold text-[#F97316]"
                >
                  Clear filters
                </button>
              )}
            </div>
          </Card>

          <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            {LEVEL_ORDER.map(l => (
              <li key={l} className="flex items-start gap-2 rounded-xl border border-[#eadfce] bg-[#fffdf9] p-3">
                <Badge variant={LEVEL_STYLE[l].badge} className="shrink-0">{SAFETY_LEVEL_LABELS[l]}</Badge>
                <span className="text-[#57534E]">{LEVEL_STYLE[l].hint}</span>
              </li>
            ))}
          </ul>

          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map(entry => <EntryCard key={entry.name} entry={entry} />)}
            </div>
          ) : (
            <Card className="text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-[#A8A29E]" aria-hidden="true" />
              <p className="font-semibold text-[#1C1917]">No match in the database</p>
              <p className="mt-1 text-sm text-[#78716C]">
                Not being listed doesn't mean a food is safe. Ask your vet before feeding anything you're unsure about.
              </p>
            </Card>
          )}

          <Disclaimer variant="info">
            {SHORT_VET_DISCLAIMER} This list covers common kitchen hazards and is not complete.
          </Disclaimer>
        </div>
      </PageWrapper>
    </>
  );
}
