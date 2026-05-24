import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply
} from './helpers/mock-providers.js';

test.describe('basic happy-path flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await configureKeys(page);
  });

  test('loads with the expected structure', async ({ page }) => {
    await expect(page).toHaveTitle(/Triangulation/);
    await expect(page.locator('.brand')).toContainText('Triangulation');
    await expect(page.locator('#panel-anthropic')).toBeVisible();
    await expect(page.locator('#panel-openai')).toBeVisible();
    await expect(page.locator('#panel-google')).toBeVisible();
  });

  test('submits a prompt and renders three source responses', async ({ page }) => {
    const calls = await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `# Response from ${provider}\n\nThis is the **answer** with markdown.`;
      if (role === 'judge') return judgeReply(85, 'The response is largely accurate.');
      return '# Truth Be Told\n\nThe consensus answer is here.';
    });

    await page.locator('#prompt').fill('What is the capital of France?');
    await page.locator('#send-btn').click();

    await expect(page.locator('#panel-anthropic .panel-body')).toContainText('Response from anthropic', { timeout: 10000 });
    await expect(page.locator('#panel-openai .panel-body')).toContainText('Response from openai');
    await expect(page.locator('#panel-google .panel-body')).toContainText('Response from google');

    expect(calls.anthropic.length).toBeGreaterThanOrEqual(3);
    expect(calls.openai.length).toBeGreaterThanOrEqual(2);
    expect(calls.google.length).toBeGreaterThanOrEqual(2);
  });

  test('renders markdown in source response bodies', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return '# Header\n\n**Bold text** and *italic*.';
      if (role === 'judge') return judgeReply(80, 'ok');
      return 'synthesis';
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();
    await expect(page.locator('#panel-anthropic .panel-body h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#panel-anthropic .panel-body strong').first()).toContainText('Bold text');
    await expect(page.locator('#panel-anthropic .panel-body em').first()).toContainText('italic');
  });

  test('renders six judge verdicts with score-coded colors', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(85, 'High score');
      return 'synthesis';
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    for (const source of ['anthropic', 'openai', 'google']) {
      for (const judge of ['anthropic', 'openai', 'google']) {
        if (source === judge) continue;
        const verdict = page.locator(`#verdict-${source}-${judge}`);
        await expect(verdict).toHaveClass(/scored/, { timeout: 15000 });
        await expect(verdict).toHaveClass(/high/);
      }
    }
  });

  test('renders the synthesis in the Truth Be Told tab', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# Truth Be Told\n\nThe consensus is that **Paris** is correct.';
    });

    await page.locator('#prompt').fill('What is the capital of France?');
    await page.locator('#send-btn').click();

    await expect(page.locator('.tab-button[data-tab="truth"] .tab-pulse')).toHaveClass(/(?:^|\s)(?!hidden)/, { timeout: 30000 }).catch(() => {});

    await page.locator('.tab-button[data-tab="truth"]').click();
    await expect(page.locator('#synthesis-body')).toContainText('consensus', { timeout: 15000 });
    await expect(page.locator('#synthesis-body strong')).toContainText('Paris');
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/);
  });

  test('populates synthesis metadata with source count, eval count, and avg', async ({ page }) => {
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# done';
    });

    await page.locator('#prompt').fill('q');
    await page.locator('#send-btn').click();
    await page.locator('.tab-button[data-tab="truth"]').click();
    await expect(page.locator('#meta-sources')).toContainText('3', { timeout: 15000 });
    await expect(page.locator('#meta-evals')).toContainText('6');
    await expect(page.locator('#meta-avg')).toContainText('80');
  });
});
