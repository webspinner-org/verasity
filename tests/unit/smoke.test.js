import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('app loader smoke test', () => {
  it('exposes expected globals after loading the HTML', () => {
    const a = api(loadApp());
    expect(typeof a.escapeHTML).toBe('function');
    expect(typeof a.renderMarkdown).toBe('function');
    expect(typeof a.renderSynthesisMarkdown).toBe('function');
    expect(typeof a.parseJudgeReply).toBe('function');
    expect(typeof a.scoreClass).toBe('function');
    expect(typeof a.buildJudgePrompt).toBe('function');
    expect(typeof a.buildSynthesisPrompt).toBe('function');
    expect(typeof a.computeSynthesisStats).toBe('function');
    expect(typeof a.callAnthropic).toBe('function');
    expect(typeof a.callOpenAI).toBe('function');
    expect(typeof a.callGoogle).toBe('function');
  });

  it('populated the DOM with provider panels', () => {
    const dom = loadApp();
    expect(dom.window.document.getElementById('panel-anthropic')).not.toBeNull();
    expect(dom.window.document.getElementById('panel-openai')).not.toBeNull();
    expect(dom.window.document.getElementById('panel-google')).not.toBeNull();
    expect(dom.window.document.getElementById('prompt')).not.toBeNull();
  });

  it('exposes expected constants', () => {
    const a = api(loadApp());
    expect(a.PROVIDERS).toEqual(['anthropic', 'openai', 'google']);
    expect(a.TOKEN_BUDGETS).toEqual({ anthropic: 4096, openai: 16384, google: 4096 });
    expect(a.SYNTHESIS_MAX_TOKENS).toBe(8192);
    expect(a.STORAGE_KEY).toBe('triangulation_v5_config');
    expect(a.SCRUB_MAX_TOKENS).toBe(8192);
  });
});
