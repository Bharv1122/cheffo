import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { Recipe } from '../../types/recipe';

interface Props {
  recipe: Recipe;
  errors?: string[];
  warnings?: string[];
}

export function ChefDoggoCheck({ recipe, errors = [], warnings = [] }: Props) {
  const checks = [
    { label: 'No toxic ingredients found', pass: errors.length === 0 },
    { label: 'Allergies avoided', pass: !errors.some(e => e.toLowerCase().includes('allergy') || e.toLowerCase().includes('allergen')) },
    { label: 'Portion estimate included', pass: !!recipe.serving },
    { label: 'Storage instructions included', pass: !!recipe.storage },
    {
      label: 'Supplement checklist included',
      pass: recipe.type === 'full_meal' || recipe.type === 'batch_week'
        ? recipe.supplements.length > 0
        : true,
    },
    {
      label: 'Vet review recommended',
      pass: true,
      note: recipe.type === 'full_meal' || recipe.type === 'batch_week' ? 'Always' : 'For major diet changes',
    },
  ];

  const allClear = errors.length === 0;

  return (
    <div className={['rounded-2xl border-2 p-4', allClear ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'].join(' ')}>
      <div className="flex items-center gap-2 mb-3">
        {allClear
          ? <CheckCircle2 size={20} className="text-green-600" />
          : <XCircle size={20} className="text-red-600" />}
        <h3 className={['font-semibold text-sm', allClear ? 'text-green-800' : 'text-red-800'].join(' ')}>
          Cheffo Doggo Check {allClear ? '— All Clear! 🐾' : '— Issues Found'}
        </h3>
      </div>

      {errors.length > 0 && (
        <div className="mb-3 space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-700">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <ul className="space-y-1.5">
        {checks.map(c => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            {c.pass
              ? <CheckCircle2 size={15} className="text-green-600 shrink-0" />
              : <XCircle size={15} className="text-red-500 shrink-0" />}
            <span className={c.pass ? 'text-green-800' : 'text-red-700'}>{c.label}</span>
            {c.note && <span className="text-xs text-green-600 ml-auto">({c.note})</span>}
          </li>
        ))}
      </ul>

      {warnings.length > 0 && (
        <div className="mt-3 space-y-1 pt-3 border-t border-green-200">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
