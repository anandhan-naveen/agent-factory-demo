import { test } from '../fixtures/demo';
import { expectToastKeepsFocusVisible } from '../support/toastClearance';

// BUG-38 (QA run 2026-10-17, D9) on the build GitHub Pages deploys, seed data, at the QA viewport.
test.describe('Demo build: toast vs keyboard focus', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('@demo @BUG-38 @FE-AC10 toast never covers the focused toggle or its badge (360 px)', async ({ page, catalog }) => {
    await catalog.open();
    await expectToastKeepsFocusVisible(page, catalog);
  });
});
