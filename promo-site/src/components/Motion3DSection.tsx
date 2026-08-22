import React from 'react';
import { motion } from 'framer-motion';

interface Motion3DSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'zoom';
}

export const Motion3DSection: React.FC<Motion3DSectionProps> = ({
  children,
  className = '',
  delay = 0,
  direction = 'up'
}) => {
  const getVariants = () => {
    switch (direction) {
      case 'left':
        return {
          hidden: { opacity: 0, x: -80, rotateY: 15, rotateZ: -2, scale: 0.94 },
          visible: { opacity: 1, x: 0, rotateY: 0, rotateZ: 0, scale: 1 }
        };
      case 'right':
        return {
          hidden: { opacity: 0, x: 80, rotateY: -15, rotateZ: 2, scale: 0.94 },
          visible: { opacity: 1, x: 0, rotateY: 0, rotateZ: 0, scale: 1 }
        };
      case 'zoom':
        return {
          hidden: { opacity: 0, z: -200, scale: 0.85, rotateX: 20 },
          visible: { opacity: 1, z: 0, scale: 1, rotateX: 0 }
        };
      case 'up':
      default:
        return {
          hidden: { opacity: 0, y: 70, rotateX: 18, scale: 0.93 },
          visible: { opacity: 1, y: 0, rotateX: 0, scale: 1 }
        };
    }
  };

  return (
    <div style={{ perspective: '1200px' }} className="w-full">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, margin: '-80px' }}
        transition={{
          duration: 0.75,
          delay,
          ease: [0.215, 0.61, 0.355, 1.0]
        }}
        variants={getVariants()}
        className={`transform-gpu ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
};
