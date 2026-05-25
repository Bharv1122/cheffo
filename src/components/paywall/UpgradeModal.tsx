import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { PaywallFeature } from '../../hooks/usePaywall';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: PaywallFeature | null;
}

const FEATURE_HEADLINES: Record<PaywallFeature, string> = {
  full_meal: 'Unlock unlimited full-meal recipes',
  batch_week: 'Unlock weekly batch recipes',
  topper: 'Unlock topper recipes',
  pantry: 'Unlock Pantry Mode',
  treat: "You've used your free treat recipe",
  assistant: 'Unlock Ask Cheffo Doggo',
  vet_export: 'Unlock Vet Export',
};

const HIGHLIGHTS = [
  'Unlimited personalized full-meal & batch recipes',
  'AI ingredient swaps and pantry-mode generation',
  'Ask Cheffo Doggo — your AI canine-nutrition assistant',
  'Vet Export PDFs + distributed vet-approval flow',
];

export function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const navigate = useNavigate();
  const headline = feature ? FEATURE_HEADLINES[feature] : 'Upgrade to Cheffo Doggo Premium';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cheffo Doggo Premium"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Maybe later
          </Button>
          <Button
            icon={<Sparkles size={16} />}
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
          >
            See plans
          </Button>
        </div>
      }
    >
      <p className="text-base font-semibold text-[#2b2118]">{headline}</p>
      <p className="mt-2 text-sm text-[#6f6459]">
        Real food first, supplements only when food can't get there. Vet-informed recipes built for your dog.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-[#3a302a]">
        {HIGHLIGHTS.map(h => (
          <li key={h} className="flex items-start gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-[#43a365]" aria-hidden="true" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-xs text-[#78716C]">
        $8/mo or $59/yr · 14-day money-back guarantee · cancel anytime
      </p>
    </Modal>
  );
}
