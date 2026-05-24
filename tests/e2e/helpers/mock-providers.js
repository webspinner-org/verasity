/**
 * Provides Playwright route handlers that mock the three provider APIs.
 * Each helper installs route interception on a page and returns control
 * objects (e.g. counters) for assertions.
 */

export function anthropicBody(text, stopReason = 'end_turn') {
  return JSON.stringify({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    usage: { input_tokens: 100, output_tokens: 50 }
  });
}

export function openaiBody(text, finishReason = 'stop') {
  return JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-5',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: finishReason
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
  });
}

export function googleBody(text, finishReason = 'STOP') {
  return JSON.stringify({
    candidates: [{
      content: { parts: [{ text }], role: 'model' },
      finishReason
    }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
  });
}

export function judgeReply(score, explanation) {
  return `SCORE: ${score}\n\nEXPLANATION:\n${explanation}`;
}

/**
 * Installs route handlers that respond to each provider with a payload
 * determined by `compute(provider, role, body)` where role is one of
 * 'source' | 'judge' | 'synthesis' (detected from prompt content).
 */
export async function installProviderRoutes(page, compute) {
  const calls = { anthropic: [], openai: [], google: [] };

  await page.route('https://api.anthropic.com/v1/messages', async (route, request) => {
    const body = JSON.parse(request.postData() || '{}');
    const prompt = body.messages?.[0]?.content || '';
    const role = detectRole(prompt);
    calls.anthropic.push({ role, body });
    const text = await compute('anthropic', role, body, prompt);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: anthropicBody(text)
    });
  });

  await page.route('https://api.openai.com/v1/chat/completions', async (route, request) => {
    const body = JSON.parse(request.postData() || '{}');
    const prompt = body.messages?.[0]?.content || '';
    const role = detectRole(prompt);
    calls.openai.push({ role, body });
    const text = await compute('openai', role, body, prompt);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: openaiBody(text)
    });
  });

  await page.route(/generativelanguage\.googleapis\.com/, async (route, request) => {
    const body = JSON.parse(request.postData() || '{}');
    const prompt = body.contents?.[0]?.parts?.[0]?.text || '';
    const role = detectRole(prompt);
    calls.google.push({ role, body });
    const text = await compute('google', role, body, prompt);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: googleBody(text)
    });
  });

  return calls;
}

function detectRole(prompt) {
  if (prompt.includes('independent evaluator')) return 'judge';
  if (prompt.includes('synthesizing the single most truthful')) return 'synthesis';
  return 'source';
}

export async function configureKeys(page, { anthropic = 'sk-ant-test', openai = 'sk-test', google = 'AIza-test' } = {}) {
  await page.locator('.settings-header').click();
  if (anthropic) await page.locator('#anthropic-key').fill(anthropic);
  if (openai)    await page.locator('#openai-key').fill(openai);
  if (google)    await page.locator('#google-key').fill(google);
  await page.locator('.settings-actions button:not(.secondary)').click();
}
