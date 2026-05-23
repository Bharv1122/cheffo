import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  // useId must run on every render (hooks order rule), so it goes before the
  // early-return-when-closed guard below.
  const titleId = React.useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={['relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]', SIZES[size]].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-[#E7E5E4]">
            <h2 id={titleId} className="text-base font-semibold text-[#1C1917]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1 rounded-lg text-[#78716C] hover:text-[#1C1917] hover:bg-[#FDF6E9] transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="p-5 border-t border-[#E7E5E4]">{footer}</div>}
      </div>
    </div>
  );
}
