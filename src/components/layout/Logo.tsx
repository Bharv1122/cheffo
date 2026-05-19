import React, { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm:  { img: 'w-7 h-7',  text: 'text-sm' },
  md:  { img: 'w-9 h-9',  text: 'text-base' },
  lg:  { img: 'w-14 h-14', text: 'text-xl' },
  xl:  { img: 'w-24 h-24', text: 'text-3xl' },
};

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const s = SIZES[size];

  return (
    <div className={['flex items-center gap-2', className].join(' ')}>
      {!imgError ? (
        <img
          src="/chef-doggo-logo.webp"
          alt="Cheffo Doggo"
          className={[s.img, 'object-contain shrink-0'].join(' ')}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={[s.img, 'shrink-0 flex items-center justify-center rounded-full bg-[#F97316] text-white font-bold'].join(' ')} style={{ fontSize: size === 'xl' ? 36 : size === 'lg' ? 22 : size === 'md' ? 16 : 12 }}>
          🐾
        </span>
      )}
      {showText && (
        <span className={['font-bold text-[#1C1917] tracking-tight', s.text].join(' ')}>
          Cheffo Doggo
        </span>
      )}
    </div>
  );
}
