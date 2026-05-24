import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('escapeHTML', () => {
  const { escapeHTML } = api(loadApp());

  it('escapes ampersands', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than and greater-than', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersand before other entities (order matters)', () => {
    expect(escapeHTML('&lt;')).toBe('&amp;lt;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHTML('Hello, world!')).toBe('Hello, world!');
  });

  it('handles multiple unsafe characters in one string', () => {
    expect(escapeHTML('<a href="x">&"</a>')).toBe('&lt;a href="x"&gt;&amp;"&lt;/a&gt;');
  });
});
