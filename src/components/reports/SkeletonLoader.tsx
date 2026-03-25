
import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-lg w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-50 rounded w-full" />
        <div className="h-4 bg-slate-50 rounded w-full" />
        <div className="h-4 bg-slate-50 rounded w-3/4" />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="h-24 bg-slate-50 rounded-xl" />
        <div className="h-24 bg-slate-50 rounded-xl" />
        <div className="h-24 bg-slate-50 rounded-xl" />
      </div>
    </div>
  );
};

export default SkeletonLoader;
