import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('buildScrubPrompt (v5)', () => {
  let a, dom;
  const cfg = {
    anthropic: { key: 'k1', model: 'claude-opus-4-7' },
    openai:    { key: 'k2', model: 'gpt-5' },
    google:    { key: 'k3', model: 'gemini-2.5-flash' }
  };

  beforeEach(() => {
    dom = loadApp();
    a = api(dom);
    a.runState.prompt = 'When did the JWST launch?';
    a.runState.synthesis = 'The JWST launched in December 2021 from French Guiana on an <spin>Ariane V</spin> rocket.';
  });

  it('includes the prior synthesis text', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'NASA passage', label: '' });
    expect(p).toContain('The JWST launched in December 2021');
    expect(p).toContain('Ariane V');
  });

  it('includes the substrate text', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'NASA launched JWST on 2021-12-25.', label: '' });
    expect(p).toContain('NASA launched JWST on 2021-12-25.');
  });

  it('includes the optional citation when provided', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: 'NASA JWST page' });
    expect(p).toContain('NASA JWST page');
  });

  it('omits the citation clause when label is empty', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(p).not.toContain('citation:');
  });

  it('omits the citation clause when label is whitespace-only', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '   ' });
    expect(p).not.toContain('citation:');
  });

  it('documents all three substrate-grounded annotation tags', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(p).toContain('<supported>');
    expect(p).toContain('</supported>');
    expect(p).toContain('<uncovered>');
    expect(p).toContain('</uncovered>');
    expect(p).toContain('<contradicted>');
    expect(p).toContain('</contradicted>');
  });

  it('instructs the model to remove prior spin/dispute tags', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(p.toLowerCase()).toMatch(/remove.*<spin>|spin.*remove/i);
  });

  it('instructs the model to be conservative', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(p.toLowerCase()).toContain('conservative');
  });

  it('instructs the model to preserve markdown', () => {
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(p.toLowerCase()).toContain('markdown');
  });

  it('handles a null synthesis gracefully', () => {
    a.runState.synthesis = null;
    const p = a.buildScrubPrompt(cfg, { text: 'passage', label: '' });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });
});
