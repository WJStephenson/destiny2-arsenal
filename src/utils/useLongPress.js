import { useRef, useCallback } from 'react';

/**
 * After a touch gesture the browser replays it as a mouse sequence
 * (mousedown/mouseup) aimed at whatever sits under the finger when it lifts.
 * That element is often not the one the gesture started on -- a flick through a
 * horizontally scrolling row ends over a different tile -- so the replayed
 * sequence has to be ignored, or the wrong tile gets "tapped".
 */
const EMULATED_MOUSE_WINDOW_MS = 800;

/**
 * Shared across every pressable, because the replayed mouse events are aimed at
 * a different element than the one that saw the touch -- a per-element flag
 * would never see them.
 */
let lastTouchAt = 0;
const markTouch = () => { lastTouchAt = Date.now(); };
const isEmulatedMouse = () => Date.now() - lastTouchAt < EMULATED_MOUSE_WINDOW_MS;

export function useLongPress(onLongPress, onClick, { delay = 380, threshold = 8 } = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const isMovedRef = useRef(false);
  // A press only counts on the element that received its own press-start.
  const isPressingRef = useRef(false);
  const startCoordsRef = useRef({ x: 0, y: 0 });

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback((event) => {
    isPressingRef.current = true;
    isLongPressRef.current = false;
    isMovedRef.current = false;
    const touch = event.touches ? event.touches[0] : event;
    startCoordsRef.current = { x: touch.clientX, y: touch.clientY };

    cancelTimer();

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!isMovedRef.current && isPressingRef.current) {
        isLongPressRef.current = true;
        try {
          if (navigator.vibrate) navigator.vibrate(35);
        } catch (e) {}
        if (onLongPress) onLongPress(event);
      }
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((event, shouldTriggerClick = true) => {
    cancelTimer();

    // Never act on a release for a press this element did not receive: the
    // pointer was dragged in from somewhere else, or this is the browser's
    // replay of a touch that started on another tile.
    const wasPressing = isPressingRef.current;
    isPressingRef.current = false;
    if (!wasPressing) return;

    // Only trigger click if the user didn't long-press AND didn't scroll/move their finger
    if (shouldTriggerClick && !isLongPressRef.current && !isMovedRef.current && onClick) {
      onClick(event);
    }
  }, [onClick]);

  const move = useCallback((event) => {
    if (!isPressingRef.current) return;
    const touch = event.touches ? event.touches[0] : event;
    const diffX = Math.abs(touch.clientX - startCoordsRef.current.x);
    const diffY = Math.abs(touch.clientY - startCoordsRef.current.y);

    if (diffX > threshold || diffY > threshold) {
      // User is scrolling: cancel long press AND prevent click
      isMovedRef.current = true;
      cancelTimer();
    }
  }, [threshold]);

  const preventContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  return {
    onTouchStart: (e) => {
      markTouch();
      start(e);
    },
    onTouchMove: (e) => {
      markTouch();
      move(e);
    },
    onTouchEnd: (e) => {
      markTouch();
      clear(e, true);
    },
    onTouchCancel: (e) => {
      markTouch();
      clear(e, false);
    },
    // Mouse handlers ignore the replayed touch sequence and secondary buttons.
    onMouseDown: (e) => {
      if (isEmulatedMouse() || (e.button !== undefined && e.button !== 0)) return;
      start(e);
    },
    onMouseMove: move,
    onMouseUp: (e) => {
      if (isEmulatedMouse() || (e.button !== undefined && e.button !== 0)) return;
      clear(e, true);
    },
    onMouseLeave: (e) => {
      if (isEmulatedMouse()) return;
      clear(e, false);
    },
    onContextMenu: preventContextMenu
  };
}
