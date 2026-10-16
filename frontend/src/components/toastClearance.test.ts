import { afterEach, describe, expect, it, vi } from 'vitest';
import { rect } from '../test/geometry';
import { HAS_TOAST_CLASS, keepFocusClearOfToast, releaseToastSpace, reserveToastSpace, scrollDeltaToClear, TOAST_SPACE_VAR } from './toastClearance';

const box = (top: number, bottom: number) => ({ top, bottom });

describe('scrollDeltaToClear (D9)', () => {
  // QA evidence at 360x780: toast 688-756, focused button 710-750, row badge just above.
  it('scrolls the covered row fully above the toast', () => {
    expect(scrollDeltaToClear(box(688, 756), box(560, 760), box(710, 750))).toBe(760 - (688 - 12));
  });

  it('returns 0 when nothing is covered', () => {
    expect(scrollDeltaToClear(box(688, 756), box(400, 600), box(550, 590))).toBe(0);
  });

  it('returns 0 for a toast with no size', () => {
    expect(scrollDeltaToClear(box(0, 0), box(0, 100), box(50, 90))).toBe(0);
  });

  it('never scrolls the focused control off the top for a very tall row', () => {
    expect(scrollDeltaToClear(box(688, 756), box(-500, 900), box(100, 140))).toBe(100 - 12);
  });
});

describe('keepFocusClearOfToast', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function setup(rowRect: DOMRect, buttonRect: DOMRect) {
    const toast = document.createElement('div');
    const close = document.createElement('button');
    close.id = 'close';
    toast.append(close);
    const row = document.createElement('li');
    row.dataset.testid = 'book-row';
    const toggle = document.createElement('button');
    row.append(toggle);
    document.body.append(toast, row);
    vi.spyOn(toast, 'getBoundingClientRect').mockReturnValue(rect(688, 756));
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rowRect);
    vi.spyOn(toggle, 'getBoundingClientRect').mockReturnValue(buttonRect);
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    return { toast, toggle, scrollBy };
  }

  it('scrolls the row of the focused toggle clear of the toast (smooth by default)', () => {
    const { toast, toggle, scrollBy } = setup(rect(560, 760), rect(710, 750));
    keepFocusClearOfToast(toast, toggle);
    expect(scrollBy).toHaveBeenCalledWith({ top: 84, behavior: 'smooth' });
  });

  it('respects prefers-reduced-motion', () => {
    const { toast, toggle, scrollBy } = setup(rect(560, 760), rect(710, 750));
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      keepFocusClearOfToast(toast, toggle);
      expect(scrollBy).toHaveBeenCalledWith({ top: 84, behavior: 'auto' });
    } finally {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  it('does nothing when the row is already clear, for body, null, or focus inside the toast', () => {
    const { toast, toggle, scrollBy } = setup(rect(100, 300), rect(250, 290));
    keepFocusClearOfToast(toast, toggle);
    keepFocusClearOfToast(toast, null);
    keepFocusClearOfToast(toast, document.body);
    keepFocusClearOfToast(toast, document.getElementById('close'));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe('reserveToastSpace / releaseToastSpace', () => {
  const root = document.documentElement;
  const VIEWPORT = window.innerHeight;
  const PAGE_HEIGHT = 2000;

  function scrolledTo(y: number) {
    vi.spyOn(root, 'scrollHeight', 'get').mockReturnValue(PAGE_HEIGHT);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);
  }

  function reserved(): boolean {
    return root.classList.contains(HAS_TOAST_CLASS) && root.style.getPropertyValue(TOAST_SPACE_VAR) !== '';
  }

  afterEach(() => {
    vi.restoreAllMocks();
    root.classList.remove(HAS_TOAST_CLASS);
    root.style.removeProperty(TOAST_SPACE_VAR);
  });

  it('reserves the toast height plus the gap', () => {
    const region = document.createElement('div');
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(rect(VIEWPORT - 92, VIEWPORT - 24));
    expect(reserveToastSpace(region)).toBe(92 + 12);
    expect(root.style.getPropertyValue(TOAST_SPACE_VAR)).toBe('104px');
    expect(root).toHaveClass(HAS_TOAST_CLASS);
  });

  it('releases at once when the page is not scrolled into the reserved space', () => {
    root.classList.add(HAS_TOAST_CLASS);
    root.style.setProperty(TOAST_SPACE_VAR, '100px');
    scrolledTo(PAGE_HEIGHT - VIEWPORT - 100);
    releaseToastSpace(100);
    expect(reserved()).toBe(false);
  });

  // R3-FE-02: at the bottom of the page, dropping the padding would clamp the scroll and jump ~90 px.
  it('keeps the space while scrolled into it and releases it once the user scrolls out', () => {
    root.classList.add(HAS_TOAST_CLASS);
    root.style.setProperty(TOAST_SPACE_VAR, '100px');
    scrolledTo(PAGE_HEIGHT - VIEWPORT);
    releaseToastSpace(100);
    expect(reserved()).toBe(true);

    window.dispatchEvent(new Event('scroll'));
    expect(reserved()).toBe(true);

    scrolledTo(PAGE_HEIGHT - VIEWPORT - 150);
    window.dispatchEvent(new Event('scroll'));
    expect(reserved()).toBe(false);
  });

  it('a pending release can be cancelled (new toast) or forced (unmount)', () => {
    root.classList.add(HAS_TOAST_CLASS);
    root.style.setProperty(TOAST_SPACE_VAR, '100px');
    scrolledTo(PAGE_HEIGHT - VIEWPORT);
    const cancel = releaseToastSpace(100);
    cancel();
    scrolledTo(0);
    window.dispatchEvent(new Event('scroll'));
    expect(reserved()).toBe(true);

    scrolledTo(PAGE_HEIGHT - VIEWPORT);
    releaseToastSpace(100)(true);
    expect(reserved()).toBe(false);
  });
});
