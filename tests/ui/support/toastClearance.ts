import { expect, type Locator, type Page } from '@playwright/test';
import type { CatalogPage } from '../pages/CatalogPage';

/** Where the toggle's bottom edge is placed before pressing Enter: inside the bottom ~70 px band (QA run D9). */
const TOGGLE_BOTTOM_OFFSET = 40;

/** Height of the bottom band the toast occupies at the QA viewport (QA run D9 step 2). */
const TOAST_BAND_HEIGHT = 70;

/** How long to poll for the app's (smooth) scroll to clear the toast; well inside its 4 s display time. */
const CLEARANCE_POLL_TIMEOUT_MS = 2_500;

export interface ClearanceReport {
  toastVisible: boolean;
  focusedIsToggle: boolean;
  focusedHitsToast: boolean;
  badgeHitsToast: boolean;
  rowHitsToast: boolean;
  focusedInViewport: boolean;
  badgeInViewport: boolean;
}

/**
 * Scrolls the page so that some row's availability toggle ends `TOGGLE_BOTTOM_OFFSET` px above the
 * bottom of the viewport (inside the area the toast occupies) and returns that row.
 * Picks the first row for which the page can actually scroll that far.
 */
export async function scrollToggleNearBottom(page: Page, catalog: CatalogPage): Promise<Locator> {
  const index = await page.evaluate((offset) => {
    const toggles = [...document.querySelectorAll('[data-testid="book-row"] [data-testid="toggle-availability"]')];
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    for (const [i, toggle] of toggles.entries()) {
      const box = toggle.getBoundingClientRect();
      const target = window.scrollY + box.bottom - (window.innerHeight - offset);
      if (target > 0 && target <= maxScroll) {
        window.scrollTo({ top: target, behavior: 'instant' });
        return i;
      }
    }
    return -1;
  }, TOGGLE_BOTTOM_OFFSET);
  expect(index, 'the list must be long enough to place a toggle near the bottom of the viewport').toBeGreaterThanOrEqual(0);
  const row = catalog.rows.nth(index);
  const toggle = row.getByTestId('toggle-availability');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('test needs a fixed viewport');
  const box = await toggle.boundingBox();
  expect(box, 'toggle is rendered').not.toBeNull();
  if (box) {
    // Precondition (D9 step 2): the toggle sits in the bottom band the toast occupies.
    expect(box.y + box.height).toBeGreaterThan(viewport.height - TOAST_BAND_HEIGHT);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  return row;
}

/** Geometry of the focused control, its row's badge and the visible toast (CSS px, viewport coordinates). */
export function measureClearance(page: Page): Promise<ClearanceReport> {
  return page.evaluate(() => {
    const intersects = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const inViewport = (r: DOMRect): boolean =>
      r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= document.documentElement.clientWidth && r.width > 0 && r.height > 0;
    const toast = document.querySelector('[data-testid="toast"]');
    const focused = document.activeElement;
    const row = focused?.closest('[data-testid="book-row"]') ?? null;
    const badge = row?.querySelector('[data-testid="availability-badge"]') ?? null;
    if (!toast || !focused || !row || !badge) {
      return {
        toastVisible: Boolean(toast),
        focusedIsToggle: false,
        focusedHitsToast: true,
        badgeHitsToast: true,
        rowHitsToast: true,
        focusedInViewport: false,
        badgeInViewport: false,
      };
    }
    const t = toast.getBoundingClientRect();
    const f = focused.getBoundingClientRect();
    const b = badge.getBoundingClientRect();
    return {
      toastVisible: t.width > 0 && t.height > 0,
      focusedIsToggle: focused.getAttribute('data-testid') === 'toggle-availability',
      focusedHitsToast: intersects(f, t),
      badgeHitsToast: intersects(b, t),
      rowHitsToast: intersects(row.getBoundingClientRect(), t),
      focusedInViewport: inViewport(f),
      badgeInViewport: inViewport(b),
    };
  });
}

/**
 * D9 / BUG-38 (WCAG 2.4.11 Focus Not Obscured): with a row's toggle near the bottom of the viewport,
 * pressing Enter on it shows a toast that must not cover the focused toggle or the badge it changed.
 */
export async function expectToastKeepsFocusVisible(page: Page, catalog: CatalogPage): Promise<void> {
  const row = await scrollToggleNearBottom(page, catalog);
  const toggle = row.getByTestId('toggle-availability');
  const badge = row.getByTestId('availability-badge');
  const badgeBefore = await badge.innerText();

  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(catalog.toast).toBeVisible();
  await expect(badge).not.toHaveText(badgeBefore);
  await expect(toggle).toBeFocused();

  // Polled while the toast (4 s) is on screen: the app may scroll smoothly to clear it.
  await expect
    .poll(() => measureClearance(page), { timeout: CLEARANCE_POLL_TIMEOUT_MS })
    .toEqual({
      toastVisible: true,
      focusedIsToggle: true,
      focusedHitsToast: false,
      badgeHitsToast: false,
      rowHitsToast: false,
      focusedInViewport: true,
      badgeInViewport: true,
    });
  await expect(catalog.toast).toBeVisible();
}
