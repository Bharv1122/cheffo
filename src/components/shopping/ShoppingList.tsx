import React, { useMemo, useState } from 'react';
import { CheckSquare, Square, Copy, Printer, Download, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import type { ShoppingListItem } from '../../types/recipe';

interface Props {
  items: ShoppingListItem[];
  recipeName?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  protein: '🥩 Proteins',
  produce: '🥦 Produce',
  pantry: '🫙 Pantry',
  supplement: '💊 Supplements',
  equipment: '📦 Equipment',
};

const CATEGORY_ORDER = ['protein', 'produce', 'pantry', 'supplement', 'equipment'];

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDisplayAmount(item: ShoppingListItem, unitPreference: 'metric' | 'us_volume'): string {
  if (unitPreference === 'metric') {
    return item.displayAmountMetric ?? item.displayAmount;
  }

  return item.displayAmountVolume ?? item.displayAmount;
}

export function ShoppingList({ items, recipeName }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [downloaded, setDownloaded] = useState(false);
  const { unitPreference } = useUnitPreference();

  const preparedItems = useMemo(
    () => items.map(item => ({ ...item, displayAmount: getDisplayAmount(item, unitPreference) })),
    [items, unitPreference]
  );

  const dedupedItems = useMemo(() => {
    const byKey = new Map<string, ShoppingListItem>();

    for (const item of preparedItems) {
      const key = `${item.category}::${item.name.trim().toLowerCase()}::${item.displayAmount.trim().toLowerCase()}`;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, item);
        continue;
      }

      if (!existing.note && item.note) {
        byKey.set(key, { ...existing, note: item.note });
      }
    }

    return Array.from(byKey.values());
  }, [preparedItems]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.reduce<Record<string, Array<{ item: ShoppingListItem; index: number }>>>((acc, category) => {
      const inCategory = dedupedItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category === category);

      if (inCategory.length) {
        acc[category] = inCategory;
      }

      return acc;
    }, {});
  }, [dedupedItems]);

  const toggle = (index: number) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  });

  const buildPlainTextExport = () => {
    const lines = [
      `🐾 Cheffo Doggo Shopping List${recipeName ? ` — ${recipeName}` : ''}`,
      `Generated on ${new Date().toLocaleDateString()}`,
      '',
    ];

    for (const category of CATEGORY_ORDER) {
      if (!grouped[category]) continue;

      lines.push(CATEGORY_LABELS[category]);

      for (const { item } of grouped[category]) {
        lines.push(`  • ${item.displayAmount}`);
        if (item.note) {
          lines.push(`    note: ${item.note}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  };

  const copyList = async () => {
    const text = buildPlainTextExport();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        document.body.removeChild(fallback);
      }

      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('idle');
      alert('Could not copy shopping list. Please try again.');
    }
  };

  const downloadText = () => {
    const text = buildPlainTextExport();
    const fileName = `${(recipeName ?? 'cheffo-doggo-shopping-list').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1800);
  };

  const printList = () => {
    const groupedHtml = CATEGORY_ORDER
      .filter(category => grouped[category])
      .map(category => {
        const itemsHtml = grouped[category]
          .map(({ item }) => `
            <li>
              <div class="item-row">${escapeHtml(item.displayAmount)}</div>
              ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ''}
            </li>
          `)
          .join('');

        return `
          <section>
            <h3>${escapeHtml(CATEGORY_LABELS[category])}</h3>
            <ul>${itemsHtml}</ul>
          </section>
        `;
      })
      .join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Cheffo Doggo Shopping List</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1C1917; }
          h1 { margin-bottom: 4px; font-size: 24px; }
          .subtitle { color: #78716C; margin-bottom: 18px; }
          section { margin-bottom: 18px; }
          h3 { margin-bottom: 8px; color: #44403C; }
          ul { margin: 0; padding-left: 18px; }
          li { margin-bottom: 8px; }
          .item-row { font-weight: 600; }
          .note { margin: 2px 0 0; font-size: 12px; color: #78716C; }
        </style>
      </head>
      <body>
        <h1>🐾 Cheffo Doggo Shopping List</h1>
        <p class="subtitle">${recipeName ? `${escapeHtml(recipeName)} • ` : ''}${new Date().toLocaleDateString()}</p>
        ${groupedHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Please allow pop-ups to open the print preview.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[#78716C] pt-1">{dedupedItems.length} items · {checked.size} checked</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto max-w-[350px]">
          <Button variant="ghost" size="sm" icon={copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />} onClick={copyList}>
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" icon={downloaded ? <Check size={14} /> : <Download size={14} />} onClick={downloadText}>
            {downloaded ? 'Downloaded' : 'Download'}
          </Button>
          <Button variant="ghost" size="sm" icon={<Printer size={14} />} onClick={printList}>
            Print
          </Button>
        </div>
      </div>

      {CATEGORY_ORDER.map(category => {
        if (!grouped[category]) return null;

        return (
          <div key={category}>
            <h4 className="text-xs font-semibold text-[#78716C] uppercase tracking-wide mb-2">{CATEGORY_LABELS[category]}</h4>
            <div className="space-y-1.5">
              {grouped[category].map(({ item, index }) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggle(index)}
                  className={[
                    'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                    checked.has(index) ? 'bg-green-50 border-green-200' : 'bg-white border-[#E7E5E4] hover:bg-[#FDF6E9]',
                  ].join(' ')}
                >
                  {checked.has(index)
                    ? <CheckSquare size={16} className="text-green-600 shrink-0 mt-0.5" />
                    : <Square size={16} className="text-[#A8A29E] shrink-0 mt-0.5" />}

                  <div className="flex-1 min-w-0">
                    <span className={['text-sm font-medium', checked.has(index) ? 'line-through text-[#A8A29E]' : 'text-[#1C1917]'].join(' ')}>
                      {item.displayAmount}
                    </span>
                    {item.note && (
                      <p className="text-xs text-[#78716C] mt-0.5 line-clamp-2">{item.note}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
