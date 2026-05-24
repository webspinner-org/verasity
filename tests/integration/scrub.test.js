import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';
import { anthropicResponse } from '../fixtures/responses.js';

describe('fireScrub orchestration (v5)', () => {
  let dom, a;
  const cfg = {
    anthropic: { key: 'sk-ant', model: 'claude-opus-4-7' },
    openai:    { key: '',       model: 'gpt-5' },
    google:    { key: '',       model: 'gemini-2.5-flash' }
  };

  beforeEach(() => {
    dom = loadApp();
    a = api(dom);
    a.runState.synthesis = 'The JWST launched in December 2021 on an <spin>Ariane V</spin>.';
  });

  it('skips with an error message when the Anthropic key is missing', async () => {
    await a.fireScrub({ anthropic: { key: '', model: 'm' } }, { text: 'passage', label: '' });
    const body = dom.window.document.getElementById('scrub-body');
    expect(body.classList.contains('error-text')).toBe(true);
    expect(body.textContent).toMatch(/Anthropic/i);
  });

  it('skips with an error message when no synthesis exists', async () => {
    a.runState.synthesis = null;
    await a.fireScrub(cfg, { text: 'passage', label: '' });
    const body = dom.window.document.getElementById('scrub-body');
    expect(body.classList.contains('error-text')).toBe(true);
    expect(body.textContent.toLowerCase()).toContain('synthesis');
  });

  it('skips with an error message when substrate is empty', async () => {
    await a.fireScrub(cfg, { text: '', label: '' });
    const body = dom.window.document.getElementById('scrub-body');
    expect(body.classList.contains('error-text')).toBe(true);
    expect(body.textContent.toLowerCase()).toMatch(/substrate|source/);
  });

  it('calls Anthropic with the scrub prompt and renders the result', async () => {
    let capturedBody;
    dom.window.fetch = vi.fn(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => anthropicResponse(
          'The JWST <supported>launched in December 2021</supported>.'
        )
      };
    });

    await a.fireScrub(cfg, { text: 'NASA: JWST launched 2021-12-25.', label: 'NASA' });

    expect(capturedBody.model).toBe('claude-opus-4-7');
    expect(capturedBody.max_tokens).toBe(a.SCRUB_MAX_TOKENS);
    expect(capturedBody.messages[0].content).toContain('NASA: JWST launched 2021-12-25.');
    expect(capturedBody.messages[0].content).toContain('NASA');

    const body = dom.window.document.getElementById('scrub-body');
    expect(body.classList.contains('md')).toBe(true);
    expect(body.innerHTML).toContain('class="supported"');
    expect(a.runState.substrate.scrubbed).toContain('<supported>');
  });

  it('populates substrate metadata after success', async () => {
    dom.window.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => anthropicResponse(
        '<supported>a</supported> <supported>b</supported> <uncovered>c</uncovered> <contradicted>d</contradicted>'
      )
    }));

    await a.fireScrub(cfg, { text: 'passage', label: '' });

    const doc = dom.window.document;
    expect(doc.getElementById('substrate-meta').style.display).not.toBe('none');
    expect(doc.getElementById('meta-supported').textContent).toBe('2');
    expect(doc.getElementById('meta-uncovered').textContent).toBe('1');
    expect(doc.getElementById('meta-contradicted').textContent).toBe('1');
    expect(doc.getElementById('meta-coverage').textContent).toBe('50%');
  });

  it('renders error state when the Anthropic call fails', async () => {
    dom.window.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
      text: async () => 'boom'
    }));

    await a.fireScrub(cfg, { text: 'passage', label: '' });

    const status = dom.window.document.getElementById('substrate-status');
    expect(status.classList.contains('error')).toBe(true);
    const body = dom.window.document.getElementById('scrub-body');
    expect(body.classList.contains('error-text')).toBe(true);
    expect(body.textContent).toMatch(/HTTP 500/);
  });
});
