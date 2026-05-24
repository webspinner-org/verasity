import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply
} from './helpers/mock-providers.js';

test.describe('tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await configureKeys(page);
  });

  test('Responses tab is active by default', async ({ page }) => {
    await expect(page.locator('.tab-button[data-tab="responses"]')).toHaveClass(/active/);
    await expect(page.locator('.tab-panel[data-tab="responses"]')).toHaveClass(/active/);
  });

  test('switches to Veracity Check tab on click', async ({ page }) => {
    await page.locator('.tab-button[data-tab="veracity"]').click();
    await expect(page.locator('.tab-button[data-tab="veracity"]')).toHaveClass(/active/);
    await expect(page.locator('.tab-panel[data-tab="veracity"]')).toHaveClass(/active/);
  });

  test('switches to Truth Be Told tab on click', async ({ page }) => {
    await page.locator('.tab-button[data-tab="truth"]').click();
    await expect(page.locator('.tab-button[data-tab="truth"]')).toHaveClass(/active/);
    await expect(page.locator('.tab-panel[data-tab="truth"]')).toHaveClass(/active/);
  });

  test('shows pulsing indicator on Truth Be Told during synthesis when user is on another tab', async ({ page }) => {
    let resolveSynthesis;
    const synthesisGate = new Promise(resolve => { resolveSynthesis = resolve; });

    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      // hold the synthesis call until the test releases it
      await synthesisGate;
      return '# Done';
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    await expect(page.locator('#truth-pulse')).not.toHaveClass(/hidden/, { timeout: 20000 });

    resolveSynthesis();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 15000 });
  });

  test('clicking the Truth Be Told tab dismisses the pulse', async ({ page }) => {
    let resolveSynthesis;
    const synthesisGate = new Promise(resolve => { resolveSynthesis = resolve; });

    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      await synthesisGate;
      return '# Done';
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    await expect(page.locator('#truth-pulse')).not.toHaveClass(/hidden/, { timeout: 20000 });
    await page.locator('.tab-button[data-tab="truth"]').click();
    await expect(page.locator('#truth-pulse')).toHaveClass(/hidden/);

    resolveSynthesis();
  });
});
