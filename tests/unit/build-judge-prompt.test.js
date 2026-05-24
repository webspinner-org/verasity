import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('buildJudgePrompt', () => {
  const { buildJudgePrompt } = api(loadApp());

  it('includes the source provider display name', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt).toContain('Anthropic');
  });

  it('includes the source model name', () => {
    const prompt = buildJudgePrompt('openai', 'gpt-5', 'q', 'a');
    expect(prompt).toContain('gpt-5');
  });

  it('includes the original prompt', () => {
    const prompt = buildJudgePrompt('google', 'gemini-2.5-flash', 'What is photosynthesis?', 'a');
    expect(prompt).toContain('What is photosynthesis?');
  });

  it('includes the source response', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'Plants convert sunlight.');
    expect(prompt).toContain('Plants convert sunlight.');
  });

  it('wraps the original prompt in triple quotes', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'X', 'Y');
    expect(prompt).toMatch(/"""\s*\nX\s*\n"""/);
  });

  it('wraps the response in triple quotes', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'X', 'Y');
    expect(prompt).toMatch(/"""\s*\nY\s*\n"""/);
  });

  it('mentions the SCORE format directive', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt).toMatch(/SCORE/);
    expect(prompt).toMatch(/0\s*[-–to]+\s*100/i);
  });

  it('mentions the EXPLANATION format directive', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt).toContain('EXPLANATION');
  });

  it('instructs the judge to cite credible sources', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt.toLowerCase()).toContain('credible');
  });

  it('asks for conflict-of-interest flagging', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt.toLowerCase()).toContain('conflict');
  });

  it('mentions markdown formatting is permitted', () => {
    const prompt = buildJudgePrompt('anthropic', 'claude-opus-4-7', 'q', 'a');
    expect(prompt.toLowerCase()).toContain('markdown');
  });
});
