// Stops the page behind a pop-up (sheet, dialog, photo viewer) from scrolling, and gives the scroll back
// when the last pop-up closes. It counts how many are open instead of each one remembering the previous
// setting: that way two pop-ups that open and close in any order, or a pop-up that redraws while it is
// open, can never leave the page stuck unable to scroll.

let open = 0;

/** Locks page scrolling; call the returned function to release this lock. */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (open++ === 0) document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--open <= 0) {
      open = 0;
      document.body.style.overflow = '';
    }
  };
}

/** Called after navigating: if no pop-up is open, make sure the page can scroll. */
export function releaseStaleScrollLock() {
  if (typeof document === 'undefined' || open > 0) return;
  if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
}
