import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress, onClick, { delay = 400, threshold = 10 } = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const startCoordsRef = useRef({ x: 0, y: 0 });

  const start = useCallback((event) => {
    isLongPressRef.current = false;
    const touch = event.touches ? event.touches[0] : event;
    startCoordsRef.current = { x: touch.clientX, y: touch.clientY };

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      try {
        if (navigator.vibrate) navigator.vibrate(35);
      } catch (e) {}
      if (onLongPress) onLongPress(event);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((event, shouldTriggerClick = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (shouldTriggerClick && !isLongPressRef.current && onClick) {
      onClick(event);
    }
  }, [onClick]);

  const move = useCallback((event) => {
    if (!timerRef.current) return;
    const touch = event.touches ? event.touches[0] : event;
    const diffX = Math.abs(touch.clientX - startCoordsRef.current.x);
    const diffY = Math.abs(touch.clientY - startCoordsRef.current.y);

    if (diffX > threshold || diffY > threshold) {
      // User is scrolling, cancel long press
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [threshold]);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: (e) => clear(e, true),
    onTouchCancel: (e) => clear(e, false),
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: (e) => clear(e, true),
    onMouseLeave: (e) => clear(e, false),
    onContextMenu: (e) => {
      if (isLongPressRef.current) {
        e.preventDefault();
      }
    }
  };
}
