import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Right-side adornment (e.g. a show/hide password toggle button) */
  trailing?: React.ReactNode;
}

export function Input({ label, error, hint, icon, trailing, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#1C1917]">
          {label}
          {props.required && <span className="text-[#F97316] ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]">{icon}</span>
        )}
        <input
          id={inputId}
          {...props}
          className={[
            'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]',
            error ? 'border-red-400' : 'border-[#E7E5E4]',
            icon ? 'pl-9' : '',
            trailing ? 'pr-10' : '',
            className,
          ].join(' ')}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C]">{trailing}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-[#78716C]">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#1C1917]">
          {label}
          {props.required && <span className="text-[#F97316] ml-1">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={[
          'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] transition-colors resize-y min-h-[80px]',
          'focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316]',
          error ? 'border-red-400' : 'border-[#E7E5E4]',
          className,
        ].join(' ')}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-[#78716C]">{hint}</p>}
    </div>
  );
}
