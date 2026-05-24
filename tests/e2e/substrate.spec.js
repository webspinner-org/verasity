import { test, expect } from '@playwright/test';
import {
  installProviderRoutes,
  configureKeys,
  judgeReply,
  anthropicBody
} from './helpers/mock-providers.js';

/**
 * Helper: installs the three baseline provider routes, then overrides
 * the Anthropic route with a custom handler that knows about the
 * synthesis and scrub roles. Playwright matches the last-registered
 * route first, so the override wins for Anthropic while OpenAI and
 * Google still go through installProviderRoutes.
 */
async function installRoutesWithAnthropicOverride(page, anthropicHandler) {
  await installProviderRoutes(page, async (provider, role) => {
    if (role === 'source') return `src ${provider}`;
    return judgeReply(80, 'ok');
  });
  await page.route('https://api.anthropic.com/v1/messages', anthropicHandler);
}

function detectRoleFromPrompt(prompt) {
  if (prompt.includes('re-evaluating')) return 'scrub';
  if (prompt.includes('synthesizing')) return 'synthesis';
  if (prompt.includes('independent evaluator')) return 'judge';
  return 'source';
}

test.describe('v5 substrate tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/triangulation.html');
    await configureKeys(page);
  });

  test('Substrate tab is rendered in the tab strip', async ({ page }) => {
    await expect(page.locator('.tab-button[data-tab="substrate"]')).toBeVisible();
  });

  test('Substrate button is disabled until a synthesis exists and substrate is non-empty', async ({ page }) => {
    await page.locator('.tab-button[data-tab="substrate"]').click();
    await expect(page.locator('#substrate-btn')).toBeDisabled();
    await page.locator('#substrate-text').fill('A passage.');
    await expect(page.locator('#substrate-btn')).toBeDisabled();
  });

  test('runs scrub after a synthesis and renders substrate-grounded tags', async ({ page }) => {
    let scrubCallSeen = false;
    await installRoutesWithAnthropicOverride(page, async route => {
      const prompt = JSON.parse(route.request().postData() || '{}').messages?.[0]?.content || '';
      const role = detectRoleFromPrompt(prompt);
      if (role === 'scrub') {
        scrubCallSeen = true;
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: anthropicBody(
            'The answer <supported>says X</supported> and <contradicted>says Y</contradicted> and <uncovered>says Z</uncovered>.'
          )
        });
      } else if (role === 'synthesis') {
        await route.fulfill({ status: 200, body: anthropicBody('Original synthesis text.') });
      } else if (role === 'judge') {
        await route.fulfill({ status: 200, body: anthropicBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: anthropicBody('Source from Anthropic') });
      }
    });

    await page.locator('#prompt').fill('test prompt');
    await page.locator('#send-btn').click();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 30000 });

    await page.locator('.tab-button[data-tab="substrate"]').click();
    await page.locator('#substrate-text').fill('Authoritative passage that we are checking against.');
    await page.locator('#substrate-label').fill('Test source');
    await expect(page.locator('#substrate-btn')).toBeEnabled();

    await page.locator('#substrate-btn').click();
    await expect(page.locator('#substrate-status')).toHaveClass(/success/, { timeout: 20000 });

    expect(scrubCallSeen).toBe(true);
    await expect(page.locator('#scrub-body span.supported')).toBeVisible();
    await expect(page.locator('#scrub-body span.contradicted')).toBeVisible();
    await expect(page.locator('#scrub-body span.uncovered')).toBeVisible();
    await expect(page.locator('#meta-supported')).toHaveText('1');
    await expect(page.locator('#meta-uncovered')).toHaveText('1');
    await expect(page.locator('#meta-contradicted')).toHaveText('1');
    await expect(page.locator('#meta-coverage')).toContainText('33');
  });

  test('uses the correct colors for the three new annotations', async ({ page }) => {
    await installRoutesWithAnthropicOverride(page, async route => {
      const prompt = JSON.parse(route.request().postData() || '{}').messages?.[0]?.content || '';
      const role = detectRoleFromPrompt(prompt);
      if (role === 'scrub') {
        await route.fulfill({
          status: 200,
          body: anthropicBody('<supported>S</supported> <uncovered>U</uncovered> <contradicted>C</contradicted>')
        });
      } else if (role === 'synthesis') {
        await route.fulfill({ status: 200, body: anthropicBody('synth') });
      } else if (role === 'judge') {
        await route.fulfill({ status: 200, body: anthropicBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: anthropicBody('Source from Anthropic') });
      }
    });

    await page.locator('#prompt').fill('q');
    await page.locator('#send-btn').click();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 30000 });

    await page.locator('.tab-button[data-tab="substrate"]').click();
    await page.locator('#substrate-text').fill('passage');
    await page.locator('#substrate-btn').click();
    await expect(page.locator('#substrate-status')).toHaveClass(/success/, { timeout: 20000 });

    const supportedColor = await page.locator('#scrub-body span.supported').evaluate(el => getComputedStyle(el).color);
    const uncoveredColor = await page.locator('#scrub-body span.uncovered').evaluate(el => getComputedStyle(el).color);
    const contradictedColor = await page.locator('#scrub-body span.contradicted').evaluate(el => getComputedStyle(el).color);

    expect(supportedColor).toBe('rgb(123, 201, 154)');    // --success
    expect(uncoveredColor).toBe('rgb(212, 185, 106)');    // --warn
    expect(contradictedColor).toBe('rgb(214, 122, 122)'); // --error
  });

  test('shows a pulse on the Substrate tab during a scrub run when user is on another tab', async ({ page }) => {
    let releaseScrub;
    const scrubGate = new Promise(res => { releaseScrub = res; });

    await installRoutesWithAnthropicOverride(page, async route => {
      const prompt = JSON.parse(route.request().postData() || '{}').messages?.[0]?.content || '';
      const role = detectRoleFromPrompt(prompt);
      if (role === 'scrub') {
        await scrubGate;
        await route.fulfill({ status: 200, body: anthropicBody('<supported>x</supported>') });
      } else if (role === 'synthesis') {
        await route.fulfill({ status: 200, body: anthropicBody('synth') });
      } else if (role === 'judge') {
        await route.fulfill({ status: 200, body: anthropicBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: anthropicBody('src') });
      }
    });

    await page.locator('#prompt').fill('q');
    await page.locator('#send-btn').click();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 30000 });

    await page.locator('.tab-button[data-tab="substrate"]').click();
    await page.locator('#substrate-text').fill('passage');
    await page.locator('#substrate-btn').click();
    await page.locator('.tab-button[data-tab="responses"]').click();
    await expect(page.locator('#substrate-pulse')).not.toHaveClass(/hidden/);

    releaseScrub();
    await expect(page.locator('#substrate-status')).toHaveClass(/success/, { timeout: 15000 });
  });

  test('clearing the substrate area resets state', async ({ page }) => {
    await installRoutesWithAnthropicOverride(page, async route => {
      const prompt = JSON.parse(route.request().postData() || '{}').messages?.[0]?.content || '';
      const role = detectRoleFromPrompt(prompt);
      if (role === 'scrub') {
        await route.fulfill({ status: 200, body: anthropicBody('<supported>x</supported>') });
      } else if (role === 'synthesis') {
        await route.fulfill({ status: 200, body: anthropicBody('synth') });
      } else if (role === 'judge') {
        await route.fulfill({ status: 200, body: anthropicBody(judgeReply(80, 'ok')) });
      } else {
        await route.fulfill({ status: 200, body: anthropicBody('src') });
      }
    });

    await page.locator('#prompt').fill('q');
    await page.locator('#send-btn').click();
    await expect(page.locator('#synthesis-status')).toHaveClass(/success/, { timeout: 30000 });

    await page.locator('.tab-button[data-tab="substrate"]').click();
    await page.locator('#substrate-text').fill('passage');
    await page.locator('#substrate-btn').click();
    await expect(page.locator('#substrate-status')).toHaveClass(/success/, { timeout: 15000 });

    await page.locator('.substrate-actions button.secondary').click();
    await expect(page.locator('#substrate-text')).toHaveValue('');
    await expect(page.locator('#scrub-body')).toContainText('Awaiting substrate input');
    await expect(page.locator('#substrate-btn')).toBeDisabled();
  });
});
