import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('renderMarkdown', () => {
  const { renderMarkdown } = api(loadApp());

  describe('headers', () => {
    it('renders H1', () => {
      expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
    });

    it('renders H2', () => {
      expect(renderMarkdown('## Title')).toContain('<h2>Title</h2>');
    });

    it('renders H3', () => {
      expect(renderMarkdown('### Title')).toContain('<h3>Title</h3>');
    });

    it('renders H4', () => {
      expect(renderMarkdown('#### Title')).toContain('<h4>Title</h4>');
    });
  });

  describe('inline emphasis', () => {
    it('renders **bold**', () => {
      expect(renderMarkdown('**hello**')).toContain('<strong>hello</strong>');
    });

    it('renders __bold__', () => {
      expect(renderMarkdown('__hello__')).toContain('<strong>hello</strong>');
    });

    it('renders *italic*', () => {
      expect(renderMarkdown('*hello*')).toContain('<em>hello</em>');
    });

    it('renders bold inside text without consuming italic', () => {
      const out = renderMarkdown('**bold** and *italic*');
      expect(out).toContain('<strong>bold</strong>');
      expect(out).toContain('<em>italic</em>');
    });
  });

  describe('code', () => {
    it('renders inline code', () => {
      expect(renderMarkdown('use `foo()` here')).toContain('<code>foo()</code>');
    });

    it('renders fenced code block', () => {
      const md = '```js\nconst x = 1;\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('<pre><code>');
      expect(html).toContain('const x = 1;');
    });

    it('does not apply markdown inside fenced code', () => {
      const md = '```\n**not bold**\n```';
      const html = renderMarkdown(md);
      expect(html).not.toContain('<strong>');
      expect(html).toContain('**not bold**');
    });

    it('escapes HTML inside fenced code', () => {
      const md = '```\n<script>x</script>\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>x</script>');
    });
  });

  describe('lists', () => {
    it('renders unordered list with hyphen', () => {
      const html = renderMarkdown('- one\n- two\n- three');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>one</li>');
      expect(html).toContain('<li>two</li>');
      expect(html).toContain('<li>three</li>');
      expect(html).toContain('</ul>');
    });

    it('renders unordered list with asterisk', () => {
      const html = renderMarkdown('* one\n* two');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>one</li>');
    });

    it('renders unordered list with plus', () => {
      const html = renderMarkdown('+ one\n+ two');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>one</li>');
    });

    it('renders ordered list', () => {
      const html = renderMarkdown('1. first\n2. second\n3. third');
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>first</li>');
      expect(html).toContain('<li>second</li>');
      expect(html).toContain('</ol>');
    });
  });

  describe('blockquotes', () => {
    it('renders single-line blockquote', () => {
      const html = renderMarkdown('> a quote');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('a quote');
      expect(html).toContain('</blockquote>');
    });
  });

  describe('horizontal rules', () => {
    it('renders --- as hr', () => {
      expect(renderMarkdown('---')).toContain('<hr>');
    });

    it('renders *** as hr', () => {
      expect(renderMarkdown('***')).toContain('<hr>');
    });

    it('renders ___ as hr', () => {
      expect(renderMarkdown('___')).toContain('<hr>');
    });
  });

  describe('links', () => {
    it('renders link with target blank and rel noopener', () => {
      const html = renderMarkdown('[click](https://example.com)');
      expect(html).toContain('<a href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
      expect(html).toContain('>click</a>');
    });
  });

  describe('paragraphs', () => {
    it('wraps a single line in p', () => {
      expect(renderMarkdown('hello')).toContain('<p>hello</p>');
    });

    it('splits paragraphs on blank line', () => {
      const html = renderMarkdown('para one\n\npara two');
      expect(html).toContain('<p>para one</p>');
      expect(html).toContain('<p>para two</p>');
    });

    it('converts single newline inside a paragraph to br', () => {
      const html = renderMarkdown('line one\nline two');
      expect(html).toContain('<br>');
    });
  });

  describe('security: HTML escaping', () => {
    it('escapes raw script tags', () => {
      const html = renderMarkdown('<script>alert(1)</script>');
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes raw img tags', () => {
      const html = renderMarkdown('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });

    it('does not pass raw HTML inside link text', () => {
      const html = renderMarkdown('[<script>](https://example.com)');
      expect(html).not.toContain('<script>https');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes ampersands in plain text', () => {
      expect(renderMarkdown('AT&T')).toContain('AT&amp;T');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(renderMarkdown('')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(renderMarkdown(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(renderMarkdown(undefined)).toBe('');
    });

    it('handles input that is a number coerced to string', () => {
      expect(renderMarkdown(42)).toContain('42');
    });
  });
});
