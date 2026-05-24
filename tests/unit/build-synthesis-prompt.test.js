import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('buildSynthesisPrompt', () => {
  let a, dom;
  const cfg = {
    anthropic: { key: 'k1', model: 'claude-opus-4-7' },
    openai:    { key: 'k2', model: 'gpt-5' },
    google:    { key: 'k3', model: 'gemini-2.5-flash' }
  };

  beforeEach(() => {
    dom = loadApp();
    a = api(dom);
    a.runState.prompt = 'What is the capital of France?';
    a.runState.responses = {
      anthropic: 'Paris is the capital.',
      openai:    'The capital is Paris.',
      google:    'Paris.'
    };
    a.runState.judgments = {
      'anthropic-openai': { score: 90, explanation: 'Correct.' },
      'anthropic-google': { score: 95, explanation: 'Accurate.' },
      'openai-anthropic': { score: 92, explanation: 'Good.' },
      'openai-google':    { score: 88, explanation: 'Right.' },
      'google-anthropic': { score: 80, explanation: 'Brief but correct.' },
      'google-openai':    { score: 82, explanation: 'Terse.' }
    };
  });

  it('includes the original prompt', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('What is the capital of France?');
  });

  it('includes all three provider names', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('Anthropic');
    expect(prompt).toContain('OpenAI');
    expect(prompt).toContain('Google');
  });

  it('includes all three model identifiers', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('claude-opus-4-7');
    expect(prompt).toContain('gpt-5');
    expect(prompt).toContain('gemini-2.5-flash');
  });

  it('includes all three source responses', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('Paris is the capital.');
    expect(prompt).toContain('The capital is Paris.');
    expect(prompt).toContain('Paris.');
  });

  it('includes all six judge verdicts with scores', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toMatch(/score:\s*90/i);
    expect(prompt).toMatch(/score:\s*95/i);
    expect(prompt).toMatch(/score:\s*92/i);
    expect(prompt).toMatch(/score:\s*88/i);
    expect(prompt).toMatch(/score:\s*80/i);
    expect(prompt).toMatch(/score:\s*82/i);
  });

  it('includes all six judge explanations', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('Correct.');
    expect(prompt).toContain('Accurate.');
    expect(prompt).toContain('Good.');
    expect(prompt).toContain('Brief but correct.');
  });

  it('explains the spin tag', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('<spin>');
    expect(prompt).toContain('</spin>');
    expect(prompt.toLowerCase()).toContain('minor');
  });

  it('explains the dispute tag', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('<dispute>');
    expect(prompt).toContain('</dispute>');
    expect(prompt.toLowerCase()).toContain('contested');
  });

  it('mentions markdown for structure', () => {
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt.toLowerCase()).toContain('markdown');
  });

  it('mentions a missing response with explicit placeholder', () => {
    a.runState.responses.google = null;
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('no response received');
  });

  it('reports zero successful evaluations gracefully', () => {
    a.runState.judgments = {};
    const prompt = a.buildSynthesisPrompt(cfg);
    expect(prompt).toContain('no successful evaluations');
  });
});
