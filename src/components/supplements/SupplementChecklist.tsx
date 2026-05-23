import React, { useState } from 'react';
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { Disclaimer } from '../ui/Disclaimer';
import type { SupplementItem } from '../../types/recipe';
import type { SuggestedDose } from '../../utils/supplementDosing';

interface Props {
  supplements: SupplementItem[];
  // Per-dog suggested doses (computed once on the recipe page and passed
  // down). When provided, rendered alongside the educational range so the
  // family sees the same starting point the vet does on the approval form.
  // (CHE-122)
  suggestions?: SuggestedDose[];
  dogName?: string;
}

export function SupplementChecklist({ supplements, suggestions, dogName }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (name: string) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  const CATEGORY_ICONS: Record<string, string> = {
    calcium: '🦴', omega3: '🐟', multivitamin: '💊', probiotic: '🌿', joint: '🏃',
  };

  return (
    <div className="space-y-3">
      <Disclaimer variant="warning" title="Estimated Supplement Checklist">
        Homemade dog food usually needs supplementation to be nutritionally complete. The information below is educational guidance only — not veterinary advice. Final supplement types, amounts, and products must be confirmed with a licensed veterinarian or veterinary nutritionist.
      </Disclaimer>

      <div className="space-y-2">
        {supplements.map(s => {
          const suggestion = suggestions?.find(x => x.supplementName === s.name);
          return (
          <div key={s.name} className={['rounded-xl border transition-colors', checked.has(s.name) ? 'border-green-300 bg-green-50' : 'border-[#E7E5E4] bg-white'].join(' ')}>
            <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => toggle(s.name)}>
              <button type="button" className="shrink-0 mt-0.5 text-[#78716C]" onClick={e => { e.stopPropagation(); toggle(s.name); }}>
                {checked.has(s.name)
                  ? <CheckSquare size={18} className="text-green-600" />
                  : <Square size={18} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[s.category]}</span>
                  <span className="text-sm font-medium text-[#1C1917]">{s.name}</span>
                  {s.isRequired && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Required</span>}
                </div>
                {s.estimatedAmount && (
                  <p className="text-xs text-[#78716C] mt-1 italic">{s.estimatedAmount}</p>
                )}
                {suggestion?.suggestion && (
                  <p className="text-xs text-[#2f7d4a] mt-1">
                    <span className="font-semibold">Suggested for {dogName ?? 'your dog'}: </span>
                    {suggestion.suggestion}
                  </p>
                )}
              </div>
              <button type="button" className="shrink-0 text-[#78716C]" onClick={e => { e.stopPropagation(); setExpanded(expanded === s.name ? null : s.name); }}>
                {expanded === s.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {expanded === s.name && s.exampleProducts && (
              <div className="px-3 pb-3 pt-0 ml-9">
                <p className="text-xs text-[#78716C] mb-1 font-medium">Example products:</p>
                <ul className="space-y-0.5">
                  {s.exampleProducts.map(p => (
                    <li key={p} className="text-xs text-[#78716C] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#A8A29E] shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 mt-2 italic">{s.vetReviewNote}</p>
              </div>
            )}
          </div>
          );
        })}
      </div>

      <p className="text-xs text-[#78716C] text-center italic">
        Ask your veterinarian which supplements and doses are right for your dog.
      </p>
    </div>
  );
}
