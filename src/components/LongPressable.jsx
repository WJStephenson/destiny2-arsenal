import React from 'react';
import { useLongPress } from '../utils/useLongPress';

export default function LongPressable({ 
  children, 
  onLongPress, 
  onClick, 
  className = '', 
  delay = 380,
  title = '',
  as = 'span'
}) {
  const Component = as;
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
    <Component 
      {...bind} 
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
      className={`cursor-pointer select-none ${className}`} 
      title={title}
    >
      {children}
    </Component>
  );
}
