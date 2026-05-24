import { describe, it, expect, vi } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';
import { openaiResponse, openaiEmpty } from '../fixtures/responses.js';

describe('callOpenAI', () => {
  function setup() {
    const dom = loadApp();
    return { dom, a: api(dom) };
  }

  it('returns the message content from a successful response', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openaiResponse('Hello from OpenAI')
    }));
    const text = await a.callOpenAI('sk-test', 'gpt-5', 'prompt');
    expect(text).toBe('Hello from OpenAI');
  });

  it('sends required Authorization header', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => openaiResponse('ok') };
    });
    await a.callOpenAI('sk-mykey', 'gpt-5', 'q');
    expect(captured.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(captured.init.headers['Authorization']).toBe('Bearer sk-mykey');
    expect(captured.init.headers['content-type']).toBe('application/json');
  });

  it('uses max_completion_tokens (not max_tokens) for reasoning models', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => openaiResponse('ok') };
    });
    await a.callOpenAI('k', 'gpt-5', 'q');
    expect(captured.max_completion_tokens).toBeDefined();
    expect(captured.max_tokens).toBeUndefined();
  });

  it('default token budget is 16384 to accommodate reasoning tokens', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => openaiResponse('ok') };
    });
    await a.callOpenAI('k', 'gpt-5', 'q');
    expect(captured.max_completion_tokens).toBe(16384);
  });

  it('throws on HTTP error', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate limit' }),
      text: async () => 'rate limit'
    }));
    await expect(a.callOpenAI('k', 'm', 'q')).rejects.toThrow(/HTTP 429/);
  });

  it('throws EmptyResponseError when content is null', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openaiEmpty('length')
    }));
    await expect(a.callOpenAI('k', 'm', 'q')).rejects.toThrow(/Empty content/);
  });

  it('includes finish_reason in the empty-response diagnostic', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openaiEmpty('length')
    }));
    await expect(a.callOpenAI('k', 'm', 'q')).rejects.toThrow(/finish_reason.*length/);
  });

  it('includes reasoning token count in the empty-response diagnostic when available', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => openaiEmpty('length', 15000)
    }));
    await expect(a.callOpenAI('k', 'm', 'q')).rejects.toThrow(/reasoning=15000/);
  });

  it('throws EmptyResponseError when content is whitespace-only', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '   ' }, finish_reason: 'stop' }],
        usage: {}
      })
    }));
    await expect(a.callOpenAI('k', 'm', 'q')).rejects.toThrow(/Empty content/);
  });
});
