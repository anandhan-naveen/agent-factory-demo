import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Runs axe (WCAG 2.0/2.1 A + AA) and fails on any serious or critical violation. Attaches the full report. */
export async function expectNoSeriousA11yViolations(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) }));
  expect(blocking, `serious/critical axe violations on ${label}`).toEqual([]);
}

/** The document must not scroll horizontally. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scrollWidth ${String(scrollWidth)} > clientWidth ${String(clientWidth)}`).toBeLessThanOrEqual(clientWidth);
}

/** The focused element shows a visible indicator (non-zero outline or a box-shadow). */
export async function expectVisibleFocusRing(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const style = await locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), boxShadow: cs.boxShadow };
  });
  const hasOutline = style.outlineStyle !== 'none' && style.outlineWidth > 0;
  const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
  expect(hasOutline || hasShadow, `no visible focus indicator: ${JSON.stringify(style)}`).toBe(true);
}
