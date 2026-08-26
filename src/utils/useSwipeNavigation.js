import { useRef, useState } from 'react';

/** How far a thumb has to travel before it counts as a swipe. */
const SWIPE_THRESHOLD_PX = 60;

/** Past this much vertical movement it is a scroll, not a swipe. */
const VERTICAL_TOLERANCE = 1.0;

/**
 * Does this element, or anything it sits inside, scroll sideways?
 *
 * The gear rows and the tab bar scroll horizontally, and a drag that started in
 * one of them belongs to that row -- taking it as a page swipe would make those
 * rows impossible to scroll on a phone.
 */
function startedInsideHorizontalScroller(target, root) {
  let node = target;
  while (node && node !== root && node.nodeType === 1) {
    if (node.dataset?.noSwipe !== undefined) return true;
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 4) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Left/right swipes that move between tabs.
 *
 * Returns handlers to spread onto the element wrapping the tab content, plus
 * the direction of the last change so the incoming panel can be animated in
 * from the side the thumb came from.
 */
export default function useSwipeNavigation({ tabs, activeTab, onChange, enabled = true }) {
  const startRef = useRef(null);
  const [direction, setDirection] = useState(null);

  const move = (delta) => {
    const index = tabs.indexOf(activeTab);
    if (index === -1) return;
    const next = index + delta;
    if (next < 0 || next >= tabs.length) return;

    setDirection(delta > 0 ? 'left' : 'right');
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (e) {}
    }
    onChange(tabs[next]);
  };

  const onTouchStart = (e) => {
    if (!enabled || e.touches.length !== 1) {
      startRef.current = null;
      return;
    }
    if (startedInsideHorizontalScroller(e.target, e.currentTarget)) {
      startRef.current = null;
      return;
    }
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (e) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    // A diagonal drag is almost always someone scrolling the page.
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_TOLERANCE) return;

    move(dx < 0 ? 1 : -1);
  };

  return {
    direction,
    goNext: () => move(1),
    goPrevious: () => move(-1),
    // Picking a tab from the bar is not a swipe, so the panel should not slide
    // in from whichever side the last swipe came from.
    selectTab: (tab) => {
      setDirection(null);
      onChange(tab);
    },
    swipeHandlers: {
      onTouchStart,
      onTouchEnd,
      onTouchCancel: () => { startRef.current = null; }
    }
  };
}
