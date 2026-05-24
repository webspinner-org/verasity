import { describe, it, expect, vi } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';
import { googleResponse, googleEmpty } from '../fixtures/responses.js';

describe('callGoogle', () => {
  function setup() {
    const dom = loadApp();
    return { dom, a: api(dom) };
  }

  it('returns the joined text from candidates.content.parts', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => googleResponse('Hello from Google')
    }));
    const text = await a.callGoogle('AIza-test', 'gemini-2.5-flash', 'prompt');
    expect(text).toBe('Hello from Google');
  });

  it('concatenates multiple parts', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [
              { text: 'Part A. ' },
              { text: 'Part B.' }
            ]
          },
          finishReason: 'STOP'
        }]
      })
    }));
    const text = await a.callGoogle('k', 'm', 'q');
    expect(text).toBe('Part A. Part B.');
  });

  it('puts the API key in the query string', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = url;
      return { ok: true, status: 200, json: async () => googleResponse('ok') };
    });
    await a.callGoogle('AIza-mykey', 'gemini-2.5-flash', 'q');
    expect(captured).toContain('key=AIza-mykey');
  });

  it('URL-encodes the model name in the path', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = url;
      return { ok: true, status: 200, json: async () => googleResponse('ok') };
    });
    await a.callGoogle('k', 'gemini-2.5-flash', 'q');
    expect(captured).toContain('gemini-2.5-flash:generateContent');
  });

  it('sends contents.parts.text in the body', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => googleResponse('ok') };
    });
    await a.callGoogle('k', 'm', 'Explain photosynthesis');
    expect(captured.contents).toEqual([{ parts: [{ text: 'Explain photosynthesis' }] }]);
  });

  it('uses maxOutputTokens in generationConfig', async () => {
    const { dom, a } = setup();
    let captured;
    dom.window.fetch = vi.fn(async (url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => googleResponse('ok') };
    });
    await a.callGoogle('k', 'm', 'q');
    expect(captured.generationConfig.maxOutputTokens).toBe(4096);
  });

  it('throws on HTTP error', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
      text: async () => 'forbidden'
    }));
    await expect(a.callGoogle('k', 'm', 'q')).rejects.toThrow(/HTTP 403/);
  });

  it('throws EmptyResponseError on empty parts with finishReason', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => googleEmpty('SAFETY')
    }));
    await expect(a.callGoogle('k', 'm', 'q')).rejects.toThrow(/Empty content.*SAFETY/);
  });

  it('throws EmptyResponseError when text is whitespace-only', async () => {
    const { dom, a } = setup();
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: '   \n' }] },
          finishReason: 'STOP'
        }]
      })
    }));
    await expect(a.callGoogle('k', 'm', 'q')).rejects.toThrow(/Empty content/);
  });
});
