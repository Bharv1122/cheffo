import React from 'react';
import { Droplets, UtensilsCrossed, CalendarDays, ShoppingBag, Cake } from 'lucide-react';
import type { RecipeType } from '../../types/recipe';

interface Option {
  type: RecipeType;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
}

const OPTIONS: Option[] = [
  {
    type: 'full_meal',
    icon: <UtensilsCrossed size={24} />,
    label: 'Full Homemade Meal',
    description: 'A complete balanced meal with supplements, shopping list, and vet guidance.',
  },
  {
    type: 'batch_week',
    icon: <CalendarDays size={24} />,
    label: 'Cook Once, Feed All Week',
    description: 'Make a 7-day batch. Cheffo Doggo handles the math, containers, and freezing plan.',
    badge: '⭐ Headline Feature',
  },
  {
    type: 'topper',
    icon: <Droplets size={24} />,
    label: 'Fresh Topper',
    description: 'A simple fresh addition to sprinkle on top of your dog\'s regular food.',
  },
  {
    type: 'pantry',
    icon: <ShoppingBag size={24} />,
    label: 'Pantry Mode',
    description: 'Tell Cheffo Doggo what you have on hand and get a safe recipe idea.',
  },
  {
    type: 'treat',
    icon: <Cake size={24} />,
    label: 'Dessert & Treats',
    description: 'Frozen treats, baked biscuits, lick mat fillers, and special occasion bowls.',
  },
];

interface Props {
  selected?: RecipeType;
  onSelect: (type: RecipeType) => void;
  // Free-plan funnel: surface the treat option (the included free taste)
  // first with a FREE badge so new users find their free recipe immediately.
  highlightFreeTreat?: boolean;
}

export function RecipeTypeSelector({ selected, onSelect, highlightFreeTreat }: Props) {
  const options = highlightFreeTreat
    ? [...OPTIONS.filter(o => o.type === 'treat'), ...OPTIONS.filter(o => o.type !== 'treat')]
    : OPTIONS;
  return (
    <div className="space-y-3">
      {options.map(opt => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onSelect(opt.type)}
          className={[
            'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150',
            selected === opt.type
              ? 'border-[#F97316] bg-orange-50'
              : 'border-[#E7E5E4] bg-white hover:border-[#F97316]/40 hover:bg-orange-50/30',
          ].join(' ')}
        >
          <span className={['shrink-0 w-12 h-12 flex items-center justify-center rounded-xl', selected === opt.type ? 'bg-[#F97316] text-white' : 'bg-[#FDF6E9] text-[#F97316]'].join(' ')}>
            {opt.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#1C1917] text-sm">{opt.label}</span>
              {highlightFreeTreat && opt.type === 'treat' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">FREE — try it first</span>
              )}
              {opt.badge && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{opt.badge}</span>}
            </div>
            <p className="text-xs text-[#78716C] mt-0.5 leading-relaxed">{opt.description}</p>
          </div>
          <div className={['w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center', selected === opt.type ? 'border-[#F97316] bg-[#F97316]' : 'border-[#E7E5E4]'].join(' ')}>
            {selected === opt.type && <span className="w-2 h-2 rounded-full bg-white" />}
          </div>
        </button>
      ))}
    </div>
  );
}
