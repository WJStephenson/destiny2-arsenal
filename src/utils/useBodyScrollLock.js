import { useEffect } from 'react';

/**
 * Hold the page still while a sheet or dialog is open.
 *
 * Without this the page carries on scrolling under the overlay: a drag that
 * starts on the backdrop scrolls the screen behind it, and on iOS a flick
 * inside the sheet rubber-bands the whole document once the sheet's own scroll
 * runs out. `overflow: hidden` alone does not stop either on iOS Safari, so the
 * body is pinned in place and put back exactly where it was on close.
 */

/**
 * How many overlays are open. Only the first pins the page and only the last
 * releases it -- a modal opened from inside another (inspecting an item from
 * the slot picker) would otherwise record a scroll position of zero on the way
 * in and drop the page at the top on the way out.
 */
let lockCount = 0;
let restoreScrollY = 0;
let savedStyles = null;

function lock() {
  lockCount += 1;
  if (lockCount > 1) return;

  const { body } = document;
  restoreScrollY = window.scrollY;
  savedStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow
  };

  body.style.position = 'fixed';
  body.style.top = `-${restoreScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !savedStyles) return;

  const { body } = document;
  body.style.position = savedStyles.position;
  body.style.top = savedStyles.top;
  body.style.left = savedStyles.left;
  body.style.right = savedStyles.right;
  body.style.width = savedStyles.width;
  body.style.overflow = savedStyles.overflow;
  savedStyles = null;

  // Pinning the body scrolled the document to the top; put the reader back.
  window.scrollTo(0, restoreScrollY);
}

export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;
  }, [active]);
}
