import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className = '' }) => {
  const controls = useAnimation();
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value !== displayValue) {
      controls.start({
        scale: [1, 1.1, 1],
        color: ['#1E4D4D', '#10B981', '#1E4D4D'],
        transition: { duration: 0.3 }
      });
      setDisplayValue(value);
    }
  }, [value, displayValue, controls]);

  return (
    <motion.span animate={controls} className={className}>
      {displayValue.toLocaleString()}
    </motion.span>
  );
};
