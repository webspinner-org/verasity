import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply
} from './helpers/mock-providers.js';

test.describe('keyboard shortcuts and controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await configureKeys(page);
  });

  test('Cmd+Enter / Ctrl+Enter in the prompt submits', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# done';
    });
    await page.locator('#prompt').fill('keyboard test');
    await page.locator('#prompt').focus();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+Enter`);
    await expect(page.locator('#panel-anthropic')).toHaveClass(/(?:success|loading)/, { timeout: 5000 });
  });

  test('Send button is disabled with "Working..." label during a run', async ({ page }) => {
    let resolveAll;
    const gate = new Promise(resolve => { resolveAll = resolve; });
    await installProviderRoutes(page, async (provider, role) => {
      if (role !== 'source') return judgeReply(80, 'ok');
      await gate;
      return `src ${provider}`;
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();
    await expect(page.locator('#send-btn')).toBeDisabled();
    await expect(page.locator('#send-btn')).toHaveText('Working...');
    resolveAll();
    await expect(page.locator('#send-btn')).toBeEnabled({ timeout: 30000 });
  });

  test('Clear button resets panels without clearing config', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# done';
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();
    await expect(page.locator('#panel-anthropic')).toHaveClass(/success/, { timeout: 15000 });

    await page.locator('.controls button.secondary').click();
    await expect(page.locator('#panel-anthropic .panel-body')).toContainText('Awaiting prompt');
    await expect(page.locator('#verdict-anthropic-openai .verdict-score')).toHaveText('—');

    // Config preserved
    const stored = await page.evaluate(() => localStorage.getItem('triangulation_v5_config'));
    expect(stored).toBeTruthy();
  });
});
