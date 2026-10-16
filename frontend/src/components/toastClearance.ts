/** Gap kept between the toast and whatever it must not cover (also absorbs the 8 px entry animation). */
export const TOAST_CLEARANCE_GAP = 12;

/** CSS custom property holding the space the visible toast takes at the bottom of the viewport. */
export const TOAST_SPACE_VAR = '--toast-space';

interface Box {
  top: number;
  bottom: number;
}

/**
 * How far the page must scroll down so that `target` (the focused control's row) ends above the
 * toast, without pushing `focused` itself past the top of the viewport. Returns 0 when nothing is
 * covered or the toast has no size (e.g. not rendered yet).
 */
export function scrollDeltaToClear(toast: Box, target: Box, focused: Box, gap = TOAST_CLEARANCE_GAP): number {
  if (toast.bottom - toast.top <= 0) return 0;
  const overlap = target.bottom - (toast.top - gap);
  if (overlap <= 0) return 0;
  // Never scroll the focused control itself out of view at the top.
  const room = Math.max(0, focused.top - gap);
  return Math.min(overlap, room);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * WCAG 2.4.11 Focus Not Obscured: scrolls the focused element (and its book row, so the badge that
 * just changed stays visible) clear of the toast.
 */
export function keepFocusClearOfToast(toastEl: HTMLElement, focused: Element | null): void {
  if (!focused || focused === document.body || toastEl.contains(focused)) return;
  const target = focused.closest('[data-testid="book-row"]') ?? focused;
  const delta = scrollDeltaToClear(toastEl.getBoundingClientRect(), target.getBoundingClientRect(), focused.getBoundingClientRect());
  if (delta > 0) window.scrollBy({ top: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** Class on <html> that turns the reserved toast space on (see styles.css). */
export const HAS_TOAST_CLASS = 'has-toast';

/**
 * Measures the toast region and reserves that much space at the bottom of the page.
 * Returns the reserved space in px.
 */
export function reserveToastSpace(region: HTMLElement): number {
  const root = document.documentElement;
  const space = Math.round(Math.max(0, window.innerHeight - region.getBoundingClientRect().top) + TOAST_CLEARANCE_GAP);
  root.style.setProperty(TOAST_SPACE_VAR, `${String(space)}px`);
  root.classList.add(HAS_TOAST_CLASS);
  return space;
}

function dropToastSpace(): void {
  const root = document.documentElement;
  root.classList.remove(HAS_TOAST_CLASS);
  root.style.removeProperty(TOAST_SPACE_VAR);
}

/** True when removing `space` px of bottom padding would force the browser to clamp the scroll position. */
function removalWouldClamp(space: number): boolean {
  const maxScrollAfter = Math.max(0, document.documentElement.scrollHeight - space - window.innerHeight);
  return window.scrollY > maxScrollAfter;
}

/**
 * Releases the reserved toast space. If the page is scrolled into that space (e.g. at the very
 * bottom), removing it now would clamp the scroll and make the page jump, so it is kept until the
 * user scrolls out of it. Returns a function that cancels a pending release (a new toast reuses
 * the space) or, with `force`, drops the space immediately (unmount).
 */
export function releaseToastSpace(space: number): (force?: boolean) => void {
  if (!removalWouldClamp(space)) {
    dropToastSpace();
    return () => undefined;
  }
  const onScroll = () => {
    if (removalWouldClamp(space)) return;
    window.removeEventListener('scroll', onScroll);
    dropToastSpace();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return (force = false) => {
    window.removeEventListener('scroll', onScroll);
    if (force) dropToastSpace();
  };
}
