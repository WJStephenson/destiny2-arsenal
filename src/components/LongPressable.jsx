import React from 'react';
import { useLongPress } from '../utils/useLongPress';

export default function LongPressable({ 
  children, 
  onLongPress, 
  onClick, 
  className = '', 
  delay = 400,
  title = ''
}) {
  const bind = useLongPress(
    (e) => {
      if (onLongPress) onLongPress(e);
    },
    (e) => {
      if (onClick) onClick(e);
    },
    { delay }
  );

  return (
    <span {...bind} className={`cursor-pointer select-none inline-flex items-center ${className}`} title={title}>
      {children}
    </span>
  );
}
