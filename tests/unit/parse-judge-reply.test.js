import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('parseJudgeReply', () => {
  const { parseJudgeReply } = api(loadApp());

  it('extracts score and explanation from the canonical format', () => {
    const reply = 'SCORE: 85\n\nEXPLANATION:\nThe response is largely accurate.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(85);
    expect(result.explanation).toBe('The response is largely accurate.');
  });

  it('tolerates lowercase score label', () => {
    const reply = 'score: 50\n\nexplanation:\nMixed accuracy.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(50);
  });

  it('tolerates a dash between SCORE and the number', () => {
    const reply = 'SCORE - 72\n\nEXPLANATION: ok';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(72);
  });

  it('falls back to first integer in 0-100 if no SCORE label is found', () => {
    const reply = 'My overall rating is 73 because most claims check out.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(73);
  });

  it('clamps fallback integer extraction to 0-100', () => {
    const reply = 'The temperature is 250 degrees but the score should be 45.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns null score when no integer can be extracted', () => {
    const reply = 'I refuse to assign a numeric score.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBeNull();
  });

  it('returns the full text as explanation when no EXPLANATION label exists', () => {
    const reply = 'SCORE: 60\nThe response is moderate.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(60);
    expect(result.explanation).toContain('moderate');
  });

  it('handles a score of 0', () => {
    const reply = 'SCORE: 0\nEXPLANATION: Completely fabricated.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(0);
  });

  it('handles a score of 100', () => {
    const reply = 'SCORE: 100\nEXPLANATION: Perfect.';
    const result = parseJudgeReply(reply);
    expect(result.score).toBe(100);
  });

  it('returns a fully populated object for empty input', () => {
    const result = parseJudgeReply('');
    expect(result).toEqual({ score: null, explanation: '', raw: '' });
  });

  it('returns a fully populated object for null input', () => {
    const result = parseJudgeReply(null);
    expect(result).toEqual({ score: null, explanation: '', raw: '' });
  });

  it('returns a fully populated object for undefined input', () => {
    const result = parseJudgeReply(undefined);
    expect(result).toEqual({ score: null, explanation: '', raw: '' });
  });

  it('preserves the raw text in the result', () => {
    const reply = 'SCORE: 42\nEXPLANATION: text';
    const result = parseJudgeReply(reply);
    expect(result.raw).toBe(reply);
  });

  it('preserves markdown in explanation', () => {
    const reply = 'SCORE: 80\nEXPLANATION:\n**Bold** and *italic* and [link](http://example.com)';
    const result = parseJudgeReply(reply);
    expect(result.explanation).toContain('**Bold**');
    expect(result.explanation).toContain('*italic*');
    expect(result.explanation).toContain('[link](http://example.com)');
  });
});
