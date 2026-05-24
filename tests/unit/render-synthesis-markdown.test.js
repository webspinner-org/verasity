import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('renderSynthesisMarkdown', () => {
  const { renderSynthesisMarkdown } = api(loadApp());

  describe('annotation tags', () => {
    it('preserves <spin> as a span with spin class', () => {
      const html = renderSynthesisMarkdown('A claim with <spin>mild caveat</spin> here.');
      expect(html).toContain('class="spin"');
      expect(html).toContain('mild caveat');
    });

    it('preserves <dispute> as a span with dispute class', () => {
      const html = renderSynthesisMarkdown('A claim with <dispute>contested fact</dispute> here.');
      expect(html).toContain('class="dispute"');
      expect(html).toContain('contested fact');
    });

    it('adds a title attribute on spin spans', () => {
      const html = renderSynthesisMarkdown('<spin>x</spin>');
      expect(html).toContain('title="Minor spin or imprecision"');
    });

    it('adds a title attribute on dispute spans', () => {
      const html = renderSynthesisMarkdown('<dispute>x</dispute>');
      expect(html).toContain('title="Disputed or contested claim"');
    });

    it('renders bold inside spin', () => {
      const html = renderSynthesisMarkdown('<spin>**bold inside**</spin>');
      expect(html).toContain('class="spin"');
      expect(html).toContain('<strong>bold inside</strong>');
    });

    it('renders italic inside dispute', () => {
      const html = renderSynthesisMarkdown('<dispute>*italic inside*</dispute>');
      expect(html).toContain('class="dispute"');
      expect(html).toContain('<em>italic inside</em>');
    });

    it('handles multiple tags in the same text', () => {
      const html = renderSynthesisMarkdown(
        'First <spin>caveat</spin> then <dispute>contested</dispute> end.'
      );
      expect(html).toContain('class="spin"');
      expect(html).toContain('class="dispute"');
      expect(html.match(/class="spin"/g) || []).toHaveLength(1);
      expect(html.match(/class="dispute"/g) || []).toHaveLength(1);
    });

    it('handles tags spanning multiple words', () => {
      const html = renderSynthesisMarkdown('a <spin>multi word phrase</spin> b');
      expect(html).toContain('multi word phrase');
    });

    it('is case-insensitive on tag names', () => {
      const html = renderSynthesisMarkdown('<SPIN>x</SPIN> and <Dispute>y</Dispute>');
      expect(html).toContain('class="spin"');
      expect(html).toContain('class="dispute"');
    });
  });

  describe('security', () => {
    it('strips other HTML tags from synthesis output', () => {
      const html = renderSynthesisMarkdown('<script>alert(1)</script> normal text');
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('does not allow event handlers on annotation spans (tag with attrs is escaped, not parsed)', () => {
      const html = renderSynthesisMarkdown('<spin onmouseover="alert(1)">x</spin>');
      // Annotation regex requires bare <spin> / <dispute> tags. An opening tag
      // with attributes falls through to the markdown renderer's HTML escape pass,
      // so the literal text appears but no active span/event handler reaches the DOM.
      expect(html).toContain('&lt;spin');
      expect(html).not.toMatch(/<span[^>]*onmouseover/);
      expect(html).not.toMatch(/<spin[^>]*onmouseover[^>]*>/);
    });

    it('strips iframes', () => {
      const html = renderSynthesisMarkdown('<iframe src="evil"></iframe>');
      expect(html).not.toContain('<iframe');
      expect(html).toContain('&lt;iframe');
    });

    it('does not nest annotation tags accidentally', () => {
      const html = renderSynthesisMarkdown('<spin>a <dispute>nested</dispute> b</spin>');
      // The implementation handles non-overlapping tags; nested behavior is
      // documented as out of scope, but the renderer should not crash
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });
  });

  describe('markdown alongside annotations', () => {
    it('renders headers outside annotations', () => {
      const html = renderSynthesisMarkdown('# Title\n\nA <spin>thing</spin>.');
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('class="spin"');
    });

    it('renders lists outside annotations', () => {
      const html = renderSynthesisMarkdown('- item one\n- item two with <dispute>flag</dispute>');
      expect(html).toContain('<ul>');
      expect(html).toContain('class="dispute"');
    });
  });
});
