import { describe, it, expect, vi } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';
import {
  anthropicResponse,
  openaiResponse,
  googleResponse,
  judgeReply
} from '../fixtures/responses.js';

/**
 * Drives the full sendPrompt() orchestration with mocked fetch.
 * Verifies the cross-evaluation matrix, synthesis, and the resulting runState.
 */
describe('orchestration: sendPrompt full pipeline', () => {
  function setup({ keys = ['anthropic', 'openai', 'google'] } = {}) {
    const dom = loadApp();
    const a = api(dom);
    const doc = dom.window.document;

    if (keys.includes('anthropic')) doc.getElementById('anthropic-key').value = 'sk-ant-test';
    if (keys.includes('openai'))    doc.getElementById('openai-key').value = 'sk-test';
    if (keys.includes('google'))    doc.getElementById('google-key').value = 'AIza-test';

    return { dom, a, doc };
  }

  function urlMatcher(url) {
    if (/api\.anthropic\.com/.test(url)) return 'anthropic';
    if (/api\.openai\.com/.test(url))    return 'openai';
    if (/generativelanguage\.googleapis/.test(url)) return 'google';
    return null;
  }

  it('produces three source responses and six judge verdicts on the happy path', async () => {
    const { dom, a, doc } = setup();

    let callIndex = 0;
    let sourceCalls = { anthropic: 0, openai: 0, google: 0 };
    let judgeCalls = { anthropic: 0, openai: 0, google: 0 };

    dom.window.fetch = vi.fn(async (url, init) => {
      const provider = urlMatcher(url);
      callIndex++;
      const body = JSON.parse(init.body);
      const prompt = body.messages
        ? body.messages[0].content
        : body.contents[0].parts[0].text;
      const isJudgePrompt = prompt.includes('independent evaluator');
      const isSynthesisPrompt = prompt.includes('synthesizing the single most truthful');

      let text;
      if (isSynthesisPrompt) {
        text = '# Truth Be Told\n\nThe consensus answer is **Paris**.';
      } else if (isJudgePrompt) {
        judgeCalls[provider]++;
        text = judgeReply(85, 'The response is well-supported.');
      } else {
        sourceCalls[provider]++;
        text = `Source answer from ${provider}.`;
      }

      let resp;
      if (provider === 'anthropic') resp = anthropicResponse(text);
      else if (provider === 'openai') resp = openaiResponse(text);
      else resp = googleResponse(text);

      return { ok: true, status: 200, json: async () => resp };
    });

    doc.getElementById('prompt').value = 'What is the capital of France?';
    await a.sendPrompt();

    expect(sourceCalls.anthropic).toBe(1);
    expect(sourceCalls.openai).toBe(1);
    expect(sourceCalls.google).toBe(1);

    expect(judgeCalls.anthropic).toBe(2);
    expect(judgeCalls.openai).toBe(2);
    expect(judgeCalls.google).toBe(2);

    expect(a.runState.responses.anthropic).toBe('Source answer from anthropic.');
    expect(a.runState.responses.openai).toBe('Source answer from openai.');
    expect(a.runState.responses.google).toBe('Source answer from google.');

    expect(Object.keys(a.runState.judgments)).toHaveLength(6);
    for (const key of ['anthropic-openai', 'anthropic-google', 'openai-anthropic',
                       'openai-google', 'google-anthropic', 'google-openai']) {
      expect(a.runState.judgments[key].score).toBe(85);
    }

    const synthBody = doc.getElementById('synthesis-body');
    expect(synthBody.innerHTML).toContain('Truth Be Told');
    expect(synthBody.innerHTML).toContain('Paris');
  });

  it('handles a failed source by marking its outgoing judges as errored', async () => {
    const { dom, a, doc } = setup();

    dom.window.fetch = vi.fn(async (url, init) => {
      const provider = urlMatcher(url);
      const body = JSON.parse(init.body);
      const prompt = body.messages ? body.messages[0].content : body.contents[0].parts[0].text;

      if (provider === 'openai' && !prompt.includes('independent evaluator') && !prompt.includes('synthesizing')) {
        return { ok: false, status: 500, json: async () => ({}), text: async () => 'server error' };
      }

      const isJudge = prompt.includes('independent evaluator');
      const isSynth = prompt.includes('synthesizing');
      const text = isSynth ? '# Synth' : (isJudge ? judgeReply(80, 'ok') : `src ${provider}`);

      let resp;
      if (provider === 'anthropic') resp = anthropicResponse(text);
      else if (provider === 'openai') resp = openaiResponse(text);
      else resp = googleResponse(text);
      return { ok: true, status: 200, json: async () => resp };
    });

    doc.getElementById('prompt').value = 'q';
    await a.sendPrompt();

    expect(a.runState.responses.openai).toBeNull();
    expect(a.runState.responses.anthropic).not.toBeNull();
    expect(a.runState.responses.google).not.toBeNull();

    // The two judgments of OpenAI's (failed) source should NOT have scores
    expect(a.runState.judgments['openai-anthropic']).toBeUndefined();
    expect(a.runState.judgments['openai-google']).toBeUndefined();

    // But the four judgments of Anthropic and Google sources SHOULD have scores
    expect(a.runState.judgments['anthropic-openai']?.score).toBe(80);
    expect(a.runState.judgments['anthropic-google']?.score).toBe(80);
    expect(a.runState.judgments['google-anthropic']?.score).toBe(80);
    expect(a.runState.judgments['google-openai']?.score).toBe(80);
  });

  it('skips synthesis with explanatory error when no Anthropic key is configured', async () => {
    const { dom, a, doc } = setup({ keys: ['openai', 'google'] });

    dom.window.fetch = vi.fn(async (url, init) => {
      const provider = urlMatcher(url);
      const body = JSON.parse(init.body);
      const prompt = body.messages ? body.messages[0].content : body.contents[0].parts[0].text;
      const isJudge = prompt.includes('independent evaluator');
      const text = isJudge ? judgeReply(70, 'ok') : `src ${provider}`;
      const resp = provider === 'openai' ? openaiResponse(text) : googleResponse(text);
      return { ok: true, status: 200, json: async () => resp };
    });

    doc.getElementById('prompt').value = 'q';
    await a.sendPrompt();

    const status = doc.getElementById('synthesis-status');
    expect(status.classList.contains('error')).toBe(true);

    const synthBody = doc.getElementById('synthesis-body');
    expect(synthBody.textContent).toMatch(/Anthropic/i);
  });

  it('parses an unparseable judge reply into the unparseable verdict state', async () => {
    const { dom, a, doc } = setup();

    dom.window.fetch = vi.fn(async (url, init) => {
      const provider = urlMatcher(url);
      const body = JSON.parse(init.body);
      const prompt = body.messages ? body.messages[0].content : body.contents[0].parts[0].text;
      const isJudge = prompt.includes('independent evaluator');
      const isSynth = prompt.includes('synthesizing');

      let text;
      if (isSynth) text = '# Done';
      else if (isJudge) text = 'I refuse to provide a numeric score.';
      else text = `src ${provider}`;

      let resp;
      if (provider === 'anthropic') resp = anthropicResponse(text);
      else if (provider === 'openai') resp = openaiResponse(text);
      else resp = googleResponse(text);
      return { ok: true, status: 200, json: async () => resp };
    });

    doc.getElementById('prompt').value = 'q';
    await a.sendPrompt();

    const verdict = doc.getElementById('verdict-anthropic-openai');
    expect(verdict.classList.contains('failed')).toBe(true);
    const scoreEl = verdict.querySelector('.verdict-score');
    expect(scoreEl.textContent).toBe('?');
  });
});
