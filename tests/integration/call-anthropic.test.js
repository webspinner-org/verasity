import { describe, it, expect, vi } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';
import { anthropicResponse, anthropicEmpty } from '../fixtures/responses.js';

describe('callAnthropic', () => {
  function setup() {
    const dom = loadApp();
    return { dom, a: api(dom) };
  }

  it('returns the joined text content from a successful response', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => anthropicResponse('Hello world')
    }));
    const text = await a.callAnthropic('sk-test', 'claude-opus-4-7', 'prompt');
    expect(text).toBe('Hello world');
  });

  it('concatenates multiple text segments', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' }
        ]
      })
    }));
    const text = await a.callAnthropic('sk-test', 'claude-opus-4-7', 'prompt');
    expect(text).toBe('Part 1. Part 2.');
  });

  it('sends required Anthropic headers', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => anthropicResponse('ok') };
    });
    await a.callAnthropic('sk-ant-mykey', 'claude-opus-4-7', 'q');
    expect(captured.url).toBe('https://api.anthropic.com/v1/messages');
    expect(captured.init.method).toBe('POST');
    expect(captured.init.headers['x-api-key']).toBe('sk-ant-mykey');
    expect(captured.init.headers['anthropic-version']).toBe('2023-06-01');
    expect(captured.init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(captured.init.headers['content-type']).toBe('application/json');
  });

  it('uses default token budget when none specified', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => anthropicResponse('ok') };
    });
    await a.callAnthropic('k', 'm', 'q');
    expect(captured.max_tokens).toBe(4096);
  });

  it('honors explicit max tokens (e.g. synthesis budget)', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => anthropicResponse('ok') };
    });
    await a.callAnthropic('k', 'm', 'q', 8192);
    expect(captured.max_tokens).toBe(8192);
  });

  it('sends prompt as a user message', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => anthropicResponse('ok') };
    });
    await a.callAnthropic('k', 'm', 'Explain photosynthesis');
    expect(captured.messages).toEqual([{ role: 'user', content: 'Explain photosynthesis' }]);
  });

  it('throws on HTTP error with status and body', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
      text: async () => '{"error":"unauthorized"}'
    }));
    await expect(a.callAnthropic('bad', 'm', 'q')).rejects.toThrow(/HTTP 401/);
  });

  it('throws EmptyResponseError on empty content with stop_reason', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => anthropicEmpty('max_tokens')
    }));
    await expect(a.callAnthropic('k', 'm', 'q')).rejects.toThrow(/Empty content.*max_tokens/);
  });

  it('throws EmptyResponseError when text is whitespace-only', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: '   \n  ' }], stop_reason: 'end_turn' })
    }));
    await expect(a.callAnthropic('k', 'm', 'q')).rejects.toThrow(/Empty content/);
  });
});
