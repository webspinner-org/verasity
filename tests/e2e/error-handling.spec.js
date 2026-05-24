import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply,
  anthropicBody,
  openaiBody,
  googleBody
} from './helpers/mock-providers.js';

test.describe('error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
  });

  test('rejects empty prompt with an alert', async ({ page }) => {
    await configureKeys(page);
    page.on('dialog', dialog => {
      expect(dialog.message().toLowerCase()).toContain('prompt');
      dialog.accept();
    });
    await page.locator('#send-btn').click();
  });

  test('rejects send when no API key is configured and opens settings', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#prompt').fill('a prompt');
    page.on('dialog', dialog => {
      expect(dialog.message().toLowerCase()).toContain('api key');
      dialog.accept();
    });
    await page.locator('#send-btn').click();
    await expect(page.locator('.settings')).toHaveClass(/open/);
  });

  test('shows error state on a panel when its source HTTP call fails', async ({ page }) => {
    await configureKeys(page);
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# Done';
    });
    await page.route('https://api.openai.com/v1/chat/completions', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = body.messages?.[0]?.content || '';
      if (!prompt.includes('independent evaluator') && !prompt.includes('synthesizing')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'server boom' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: openaiBody(judgeReply(80, 'ok'))
      });
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    await expect(page.locator('#panel-openai')).toHaveClass(/error/, { timeout: 15000 });
    await expect(page.locator('#panel-openai .panel-body')).toContainText('HTTP 500');
  });

  test('marks outgoing judges as errored when their source failed', async ({ page }) => {
    await configureKeys(page);
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# Done';
    });
    await page.route('https://api.openai.com/v1/chat/completions', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = body.messages?.[0]?.content || '';
      if (!prompt.includes('independent evaluator') && !prompt.includes('synthesizing')) {
        await route.fulfill({ status: 500, body: '{}' });
        return;
      }
      await route.fulfill({ status: 200, body: openaiBody(judgeReply(80, 'ok')) });
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();
    await page.locator('.tab-button[data-tab="veracity"]').click();

    await expect(page.locator('#pill-openai-anthropic')).toContainText('—', { timeout: 15000 });
    await expect(page.locator('#pill-openai-google')).toContainText('—');
  });

  test('shows an EMPTY pill for a judge that returned an empty response', async ({ page }) => {
    await configureKeys(page);

    let openaiCallCount = 0;
    await page.route('https://api.openai.com/v1/chat/completions', async route => {
      openaiCallCount++;
      // First call: source response. Subsequent OpenAI calls (as judge) return empty.
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = body.messages?.[0]?.content || '';
      if (prompt.includes('independent evaluator')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            choices: [{
              message: { content: null },
              finish_reason: 'length'
            }],
            usage: {
              total_tokens: 16000,
              completion_tokens: 16000,
              completion_tokens_details: { reasoning_tokens: 15500 }
            }
          })
        });
        return;
      }
      await route.fulfill({ status: 200, body: openaiBody('Source from OpenAI') });
    });
    await page.route('https://api.anthropic.com/v1/messages', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = body.messages?.[0]?.content || '';
      if (prompt.includes('synthesizing')) {
        await route.fulfill({ status: 200, body: anthropicBody('# done') });
      } else if (prompt.includes('independent evaluator')) {
        await route.fulfill({ status: 200, body: anthropicBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: anthropicBody('Source from Anthropic') });
      }
    });
    await page.route(/generativelanguage\.googleapis\.com/, async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      const prompt = body.contents?.[0]?.parts?.[0]?.text || '';
      if (prompt.includes('independent evaluator')) {
        await route.fulfill({ status: 200, body: googleBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: googleBody('Source from Google') });
      }
    });

    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    // The OpenAI judging of anthropic and google sources should both be EMPTY
    await expect(page.locator('#pill-anthropic-openai')).toContainText('EMPTY', { timeout: 30000 });
    await expect(page.locator('#pill-google-openai')).toContainText('EMPTY');
  });

  test('reports "No API key configured" for providers without a key', async ({ page }) => {
    await configureKeys(page, { anthropic: 'sk-ant-test', openai: 'sk-test', google: '' });
    await installProviderRoutes(page, async (provider, role) => {
      if (role === 'source') return `src ${provider}`;
      if (role === 'judge') return judgeReply(80, 'ok');
      return '# Done';
    });
    await page.locator('#prompt').fill('test');
    await page.locator('#send-btn').click();

    await expect(page.locator('#panel-google')).toHaveClass(/error/, { timeout: 15000 });
    await expect(page.locator('#panel-google .panel-body')).toContainText('No API key');
  });
});
