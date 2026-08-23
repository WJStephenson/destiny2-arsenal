import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress, onClick, { delay = 380, threshold = 8 } = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const isMovedRef = useRef(false);
  const startCoordsRef = useRef({ x: 0, y: 0 });

  const start = useCallback((event) => {
    isLongPressRef.current = false;
    isMovedRef.current = false;
    const touch = event.touches ? event.touches[0] : event;
    startCoordsRef.current = { x: touch.clientX, y: touch.clientY };

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (!isMovedRef.current) {
        isLongPressRef.current = true;
        try {
          if (navigator.vibrate) navigator.vibrate(35);
        } catch (e) {}
        if (onLongPress) onLongPress(event);
      }
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((event, shouldTriggerClick = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only trigger click if the user didn't long-press AND didn't scroll/move their finger
    if (shouldTriggerClick && !isLongPressRef.current && !isMovedRef.current && onClick) {
      onClick(event);
    }
  }, [onClick]);

  const move = useCallback((event) => {
    const touch = event.touches ? event.touches[0] : event;
    const diffX = Math.abs(touch.clientX - startCoordsRef.current.x);
    const diffY = Math.abs(touch.clientY - startCoordsRef.current.y);

    if (diffX > threshold || diffY > threshold) {
      // User is scrolling: cancel long press AND prevent click
      isMovedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [threshold]);

  const preventContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: (e) => clear(e, true),
    onTouchCancel: (e) => clear(e, false),
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: (e) => clear(e, true),
    onMouseLeave: (e) => clear(e, false),
    onContextMenu: preventContextMenu
  };
}
