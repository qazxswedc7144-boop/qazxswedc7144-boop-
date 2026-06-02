import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface PullToRefreshProps extends React.HTMLAttributes<HTMLDivElement> {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ 
  onRefresh, 
  children, 
  disabled = false,
  className = '',
  ...props 
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const pullThreshold = 65; // px
  const maxPullDistance = 110; // px

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull-to-refresh if we are at the top of the container scroll
      const scrollTop = container.scrollTop;
      if (scrollTop <= 5 && pullState !== 'refreshing') {
        const touch = e.touches && e.touches[0];
        if (touch) {
          startYRef.current = touch.clientY;
          isPullingRef.current = true;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || pullState === 'refreshing') return;
      
      const touch = e.touches && e.touches[0];
      if (!touch) return;
      
      const currentY = touch.clientY;
      const deltaY = currentY - startYRef.current;
      
      if (deltaY > 0) {
        // Resistance factor to make pull feel premium and natural
        const distance = Math.min(deltaY * 0.4, maxPullDistance);
        setPullDistance(distance);
        
        if (distance >= pullThreshold) {
          setPullState('ready');
        } else {
          setPullState('pulling');
        }
        
        // Prevent default scrolling down behaviour to enable pure pulling gesture
        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        // Scrolling up/normal scrolling, do not pull
        isPullingRef.current = false;
        setPullDistance(0);
        setPullState('idle');
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistance >= pullThreshold && pullState !== 'refreshing') {
        setPullState('refreshing');
        setPullDistance(pullThreshold); // hold spinner in place

        try {
          await onRefresh();
        } catch (e) {
          console.error("[PullToRefresh] refresh handler throwing error:", e);
        } finally {
          // Beautiful spring animation reset
          setPullDistance(0);
          setPullState('idle');
        }
      } else {
        // Retract pulling indicators
        setPullDistance(0);
        setPullState('idle');
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, pullState, pullDistance, onRefresh]);

  return (
    <div 
      {...props}
      ref={containerRef} 
      className={`relative select-none ${className}`}
      style={{
        ...props.style,
        WebkitOverflowScrolling: 'touch', // smooth native iOS momentum scrolling
      }}
    >
      {/* Pull down indicator block */}
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: Math.min(pullDistance / pullThreshold, 1), 
              scale: 1,
              y: Math.min(pullDistance - 50, 20)
            }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="absolute left-0 right-0 top-2 flex justify-center pointer-events-none z-[80]"
          >
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur border border-slate-100 dark:border-gray-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none py-2 px-4 rounded-full flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              {pullState === 'refreshing' ? (
                <RefreshCw size={15} className="animate-spin text-indigo-500 shrink-0" />
              ) : pullState === 'ready' ? (
                <RefreshCw size={15} className="rotate-180 transition-transform duration-200 text-[#1E4D4D] dark:text-emerald-400 shrink-0" />
              ) : (
                <ArrowDown size={15} className="animate-bounce shrink-0" />
              )}
              
              <span className="text-[11px] font-black font-sans">
                {pullState === 'refreshing' && 'جاري تحديث البيانات...'}
                {pullState === 'ready' && 'أفلت للتحديث الآن'}
                {pullState === 'pulling' && 'اسحب للتحديث...'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div 
        className="h-full w-full"
        style={{
          transform: `translateY(${pullState === 'refreshing' ? 15 : Math.max(0, pullDistance - 25)}px)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
};
