import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('computeSynthesisStats', () => {
  let a;

  beforeEach(() => {
    a = api(loadApp());
  });

  it('returns zero counts and null avg for an empty run state', () => {
    const stats = a.computeSynthesisStats();
    expect(stats).toEqual({ sources: 0, evals: 0, avg: null });
  });

  it('counts non-null responses as sources', () => {
    a.runState.responses = {
      anthropic: 'one',
      openai:    null,
      google:    'three'
    };
    const stats = a.computeSynthesisStats();
    expect(stats.sources).toBe(2);
  });

  it('counts scored judgments as evals', () => {
    a.runState.judgments = {
      'anthropic-openai': { score: 80 },
      'openai-google':    { score: 70 }
    };
    const stats = a.computeSynthesisStats();
    expect(stats.evals).toBe(2);
  });

  it('computes average of scored judgments', () => {
    a.runState.judgments = {
      'a-o': { score: 80 },
      'o-g': { score: 60 },
      'g-a': { score: 100 }
    };
    const stats = a.computeSynthesisStats();
    expect(stats.avg).toBeCloseTo(80, 5);
  });

  it('ignores judgments with null score in the average', () => {
    a.runState.judgments = {
      'a-o': { score: 80 },
      'o-g': { score: null },
      'g-a': { score: 60 }
    };
    const stats = a.computeSynthesisStats();
    expect(stats.evals).toBe(2);
    expect(stats.avg).toBeCloseTo(70, 5);
  });

  it('handles a single scored judgment', () => {
    a.runState.judgments = { 'a-o': { score: 42 } };
    const stats = a.computeSynthesisStats();
    expect(stats.sources).toBe(0);
    expect(stats.evals).toBe(1);
    expect(stats.avg).toBe(42);
  });
});
