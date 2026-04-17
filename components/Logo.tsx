
import React from 'react';

export const Logo: React.FC<{ className?: string; size?: number }> = ({ className = "", size = 40 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#AEECEF" />
            <stop offset="100%" stopColor="#1E4D4D" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Background Rounded Square (Squircle-ish) */}
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="25"
          fill="url(#logoGradient)"
          filter="url(#shadow)"
        />
        
        {/* Capsule Shape */}
        <g transform="translate(50, 50) rotate(-45)">
          <rect
            x="-12"
            y="-30"
            width="24"
            height="60"
            rx="12"
            fill="#1E4D4D"
            opacity="0.8"
          />
          <path
            d="M-12 0 C-12 -16.5685 -6.62742 -30 0 -30 C6.62742 -30 12 -16.5685 12 0 L12 30 C12 30 6.62742 30 0 30 C-6.62742 30 -12 30 -12 30 Z"
            fill="#AEECEF"
            opacity="0.3"
          />
        </g>
        
        {/* stylized PF */}
        <text
          x="30"
          y="65"
          fill="#10B981"
          style={{
            fontFamily: 'Cairo, sans-serif',
            fontWeight: 900,
            fontSize: '38px',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          PF
        </text>
        
        {/* Arrow */}
        <path
          d="M65 35 L80 20 M80 20 L70 20 M80 20 L80 30"
          stroke="#10B981"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 70 Q60 70 75 30"
          stroke="#10B981"
          strokeWidth="4"
          strokeDasharray="1 8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export const BrandName: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center font-black tracking-tighter ${className}`}>
      <span className="text-[#1E4D4D]">PHARMA</span>
      <span className="text-[#10B981]">FLOW</span>
    </div>
  );
};

export const Tagline: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest ${className}`}>
      Smart Logistics • Precision Data • Streamlined Workflows
    </p>
  );
};
