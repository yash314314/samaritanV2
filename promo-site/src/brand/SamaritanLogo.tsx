import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export const SamaritanSymbol: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    {/* Outer Temporal Ring */}
    <circle
      cx="24"
      cy="24"
      r="18"
      stroke="url(#brandGrad)"
      strokeWidth="3"
      strokeDasharray="6 3"
    />
    {/* Inner Temporal Axis Loop */}
    <path
      d="M14 24C14 18.4772 18.4772 14 24 14C29.5228 14 34 18.4772 34 24C34 29.5228 29.5228 34 24 34"
      stroke="#818CF8"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Active Focus Core */}
    <circle cx="24" cy="24" r="4" fill="#6366F1" />
    <circle cx="24" cy="24" r="7" stroke="#6366F1" strokeWidth="1" strokeOpacity="0.5" />

    {/* Temporal Orbits */}
    <circle cx="42" cy="24" r="2.5" fill="#818CF8" />
    <circle cx="24" cy="6" r="2.5" fill="#4F46E5" />

    <defs>
      <linearGradient id="brandGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="0.5" stopColor="#4F46E5" />
        <stop offset="1" stopColor="#818CF8" />
      </linearGradient>
    </defs>
  </svg>
);

export const SamaritanLogo: React.FC<LogoProps> = ({ size = 32, className = '', showWordmark = true }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SamaritanSymbol size={size} />
      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 leading-none">
            <span className="font-extrabold text-base tracking-[0.2em] text-white font-mono">SAMARITAN</span>
            <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
              V2.0
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase mt-0.5">
            Temporal Focus System
          </span>
        </div>
      )}
    </div>
  );
};
