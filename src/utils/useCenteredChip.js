import { useEffect, useRef } from 'react';

/**
 * Keep the selected chip in the middle of a row that scrolls sideways.
 *
 * A tab bar wider than the screen leaves the chip you just swiped to sitting
 * off the edge, or half under it -- so the bar stops agreeing with the panel
 * below it. Centring on every change means the tab you are on is always the one
 * in front of you, and the tabs either side are always the ones a swipe away.
 *
 * Returns a ref for the scrolling container. Chips inside it are found by
 * `data-chip`, so the hook needs no ref of its own for each one.
 */
export default function useCenteredChip(activeKey) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chip = container.querySelector(`[data-chip="${activeKey}"]`);
    if (!chip) return;

    // Measured rather than read off `offsetLeft`, which is relative to whatever
    // ancestor happens to be positioned rather than to the scroller itself.
    const containerBox = container.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const offset = (chipBox.left + chipBox.width / 2) - (containerBox.left + containerBox.width / 2);

    const furthest = container.scrollWidth - container.clientWidth;
    const target = Math.max(0, Math.min(container.scrollLeft + offset, furthest));
    // Already there, near enough: a scroll of a pixel or two only stutters.
    if (Math.abs(target - container.scrollLeft) < 2) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeKey]);

  return containerRef;
}
