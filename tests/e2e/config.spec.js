import { test, expect } from '@playwright/test';

test.describe('configuration panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens the config panel and reveals key/model inputs', async ({ page }) => {
    await page.locator('.settings-header').click();
    await expect(page.locator('#anthropic-key')).toBeVisible();
    await expect(page.locator('#openai-key')).toBeVisible();
    await expect(page.locator('#google-key')).toBeVisible();
  });

  test('renders key fields as password type', async ({ page }) => {
    await page.locator('.settings-header').click();
    await expect(page.locator('#anthropic-key')).toHaveAttribute('type', 'password');
    await expect(page.locator('#openai-key')).toHaveAttribute('type', 'password');
    await expect(page.locator('#google-key')).toHaveAttribute('type', 'password');
  });

  test('seeds default model names', async ({ page }) => {
    await page.locator('.settings-header').click();
    await expect(page.locator('#anthropic-model')).toHaveValue('claude-opus-4-7');
    await expect(page.locator('#openai-model')).toHaveValue('gpt-5');
    await expect(page.locator('#google-model')).toHaveValue('gemini-2.5-flash');
  });

  test('saves config and shows the Saved indicator', async ({ page }) => {
    await page.locator('.settings-header').click();
    await page.locator('#anthropic-key').fill('sk-ant-saved');
    await page.locator('.settings-actions button:not(.secondary)').click();
    await expect(page.locator('#save-status')).toHaveClass(/visible/);

    const stored = await page.evaluate(() => localStorage.getItem('triangulation_v4_1_config'));
    expect(stored).toBeTruthy();
    const cfg = JSON.parse(stored);
    expect(cfg.anthropicKey).toBe('sk-ant-saved');
  });

  test('persists config across reloads', async ({ page }) => {
    await page.locator('.settings-header').click();
    await page.locator('#anthropic-key').fill('sk-ant-reloaded');
    await page.locator('#openai-model').fill('gpt-custom');
    await page.locator('.settings-actions button:not(.secondary)').click();

    await page.reload();
    await page.locator('.settings-header').click();
    await expect(page.locator('#anthropic-key')).toHaveValue('sk-ant-reloaded');
    await expect(page.locator('#openai-model')).toHaveValue('gpt-custom');
  });

  test('updates the model labels live as the user types', async ({ page }) => {
    await page.locator('.settings-header').click();
    await page.locator('#anthropic-model').fill('claude-opus-test');
    await expect(page.locator('#label-anthropic')).toHaveText('claude-opus-test');
    await expect(page.locator('#subject-model-anthropic')).toHaveText('claude-opus-test');
  });

  test('Clear removes credentials after user confirms', async ({ page }) => {
    await page.locator('.settings-header').click();
    await page.locator('#anthropic-key').fill('sk-ant-test');
    await page.locator('.settings-actions button:not(.secondary)').click();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.settings-actions button.secondary').click();

    await expect(page.locator('#anthropic-key')).toHaveValue('');
    await expect(page.locator('#anthropic-model')).toHaveValue('claude-opus-4-7');
    const stored = await page.evaluate(() => localStorage.getItem('triangulation_v4_1_config'));
    expect(stored).toBeNull();
  });

  test('Clear does nothing if the user dismisses the confirm dialog', async ({ page }) => {
    await page.locator('.settings-header').click();
    await page.locator('#anthropic-key').fill('sk-keep');
    await page.locator('.settings-actions button:not(.secondary)').click();

    page.on('dialog', dialog => dialog.dismiss());
    await page.locator('.settings-actions button.secondary').click();

    await expect(page.locator('#anthropic-key')).toHaveValue('sk-keep');
  });

  test('migrates config from a legacy storage key', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('triangulation_v3_1_config', JSON.stringify({
        anthropicKey: 'sk-from-legacy',
        googleModel: 'gemini-legacy'
      }));
    });
    await page.reload();
    await page.locator('.settings-header').click();
    await expect(page.locator('#anthropic-key')).toHaveValue('sk-from-legacy');
    await expect(page.locator('#google-model')).toHaveValue('gemini-legacy');
  });
});
