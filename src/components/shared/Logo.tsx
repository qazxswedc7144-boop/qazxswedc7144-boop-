
import React from 'react';

export const Logo: React.FC<{ className?: string; size?: number }> = ({ className = "", size = 40 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 ${className}`} 
      style={{ width: size, height: size }}
    >
      {/* Background shape with gradient and slight rotation */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E4D4D] to-[#10B981] rounded-xl shadow-lg transform rotate-3 transition-transform duration-300 hover:rotate-12"></div>
      
      {/* Inner white container */}
      <div className="absolute inset-[2px] bg-white rounded-[10px] shadow-sm flex items-center justify-center overflow-hidden z-10">
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E4D4D" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          {/* Medical Cross / Pharmacy Symbol */}
          <path
            d="M10.5 2V8.5H4V15.5H10.5V22H17.5V15.5H24V8.5H17.5V2H10.5Z"
            fill="url(#brandGradient)"
            className="opacity-90"
          />
          {/* Flowing Wave inside */}
          <path
            d="M4 12C8 12 10 9 14 9C18 9 20 12 24 12"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export const BrandName: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div dir="ltr" className={`flex items-center justify-center font-black tracking-tighter ${className}`}>
      <span className="text-[#1E4D4D]">Pharma</span>
      <span className="text-[#10B981]">Flow</span>
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
