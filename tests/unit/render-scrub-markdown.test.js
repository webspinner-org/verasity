import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('renderScrubMarkdown / extended renderSynthesisMarkdown (v5)', () => {
  const { renderScrubMarkdown, renderSynthesisMarkdown } = api(loadApp());

  describe('substrate-grounded annotation tags', () => {
    it('renders <supported> as a span with supported class', () => {
      const html = renderScrubMarkdown('Claim <supported>verified fact</supported>.');
      expect(html).toContain('class="supported"');
      expect(html).toContain('verified fact');
    });

    it('renders <uncovered> as a span with uncovered class', () => {
      const html = renderScrubMarkdown('Claim <uncovered>not addressed</uncovered>.');
      expect(html).toContain('class="uncovered"');
    });

    it('renders <contradicted> as a span with contradicted class', () => {
      const html = renderScrubMarkdown('Claim <contradicted>refuted fact</contradicted>.');
      expect(html).toContain('class="contradicted"');
    });

    it('adds tooltip titles per tag', () => {
      const html = renderScrubMarkdown(
        '<supported>a</supported> <uncovered>b</uncovered> <contradicted>c</contradicted>'
      );
      expect(html).toContain('title="Supported by substrate"');
      expect(html).toContain('title="Substrate is silent on this claim"');
      expect(html).toContain('title="Contradicted by substrate"');
    });

    it('still renders spin and dispute (back-compat with synthesis tags)', () => {
      const html = renderScrubMarkdown('<spin>a</spin> <dispute>b</dispute>');
      expect(html).toContain('class="spin"');
      expect(html).toContain('class="dispute"');
    });

    it('renders markdown inside substrate annotations', () => {
      const html = renderScrubMarkdown('<supported>**bold inside**</supported>');
      expect(html).toContain('class="supported"');
      expect(html).toContain('<strong>bold inside</strong>');
    });
  });

  it('renderScrubMarkdown and renderSynthesisMarkdown produce identical output', () => {
    const sample = 'Mixed: <supported>a</supported>, <spin>b</spin>, <contradicted>c</contradicted>';
    expect(renderScrubMarkdown(sample)).toBe(renderSynthesisMarkdown(sample));
  });
});
