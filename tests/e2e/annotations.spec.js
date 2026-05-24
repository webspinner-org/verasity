import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply
} from './helpers/mock-providers.js';

test.describe('synthesis annotations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await configureKeys(page);
  });

  async function runWithSynthesis(page, synthesisText) {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(75, 'ok');
      return synthesisText;
    });
    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();
    await page.locator('.tab-button[data-tab="truth"]').click();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 30000 });
  }

  test('renders <spin> tag as a span with yellow text', async ({ page }) => {
    await runWithSynthesis(page, 'A claim with <spin>mild caveat</spin> here.');
    const span = page.locator('#synthesis-body span.spin');
    await expect(span).toBeVisible();
    await expect(span).toContainText('mild caveat');
    const color = await span.evaluate(el => getComputedStyle(el).color);
    // CSS var --warn = #d4b96a → rgb(212, 185, 106)
    expect(color).toBe('rgb(212, 185, 106)');
  });

  test('renders <dispute> tag as a span with red text', async ({ page }) => {
    await runWithSynthesis(page, 'A claim with <dispute>contested fact</dispute> here.');
    const span = page.locator('#synthesis-body span.dispute');
    await expect(span).toBeVisible();
    await expect(span).toContainText('contested fact');
    const color = await span.evaluate(el => getComputedStyle(el).color);
    // CSS var --error = #d67a7a → rgb(214, 122, 122)
    expect(color).toBe('rgb(214, 122, 122)');
  });

  test('renders bold markdown inside an annotation span', async ({ page }) => {
    await runWithSynthesis(page, 'Note <spin>**emphasized concern**</spin> here.');
    const strong = page.locator('#synthesis-body span.spin strong');
    await expect(strong).toContainText('emphasized concern');
  });

  test('shows tooltip text on annotation spans', async ({ page }) => {
    await runWithSynthesis(page, 'A <spin>spin</spin> and a <dispute>dispute</dispute>.');
    await expect(page.locator('#synthesis-body span.spin')).toHaveAttribute('title', /Minor spin/);
    await expect(page.locator('#synthesis-body span.dispute')).toHaveAttribute('title', /Disputed/);
  });

  test('does not render annotation spans with background or underline', async ({ page }) => {
    await runWithSynthesis(page, 'Has <spin>caveat</spin>.');
    const span = page.locator('#synthesis-body span.spin');
    const styles = await span.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        textDecoration: cs.textDecorationLine
      };
    });
    expect(styles.background).toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/);
    expect(styles.textDecoration).toBe('none');
  });

  test('escapes raw script tags from synthesis output', async ({ page }) => {
    await runWithSynthesis(page, '<script>window.HACKED = true</script>Normal text.');
    const hacked = await page.evaluate(() => window.HACKED);
    expect(hacked).toBeUndefined();
    await expect(page.locator('#synthesis-body')).toContainText('Normal text');
  });

  test('legend is visible on the Truth Be Told tab', async ({ page }) => {
    await runWithSynthesis(page, 'Just text.');
    await expect(page.locator('.synthesis-legend .legend-text-swatch.consensus')).toBeVisible();
    await expect(page.locator('.synthesis-legend .legend-text-swatch.spin-color')).toBeVisible();
    await expect(page.locator('.synthesis-legend .legend-text-swatch.dispute-color')).toBeVisible();
  });
});
