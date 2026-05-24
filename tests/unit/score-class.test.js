import { describe, it, expect } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('scoreClass', () => {
  const { scoreClass } = api(loadApp());

  it('classifies 100 as high', () => {
    expect(scoreClass(100)).toBe('high');
  });

  it('classifies 70 as high (boundary)', () => {
    expect(scoreClass(70)).toBe('high');
  });

  it('classifies 69 as mid (just below high)', () => {
    expect(scoreClass(69)).toBe('mid');
  });

  it('classifies 40 as mid (boundary)', () => {
    expect(scoreClass(40)).toBe('mid');
  });

  it('classifies 39 as low (just below mid)', () => {
    expect(scoreClass(39)).toBe('low');
  });

  it('classifies 0 as low', () => {
    expect(scoreClass(0)).toBe('low');
  });

  it.each([
    [85, 'high'],
    [55, 'mid'],
    [20, 'low'],
    [99, 'high'],
    [50, 'mid'],
    [1, 'low']
  ])('scoreClass(%i) -> %s', (score, expected) => {
    expect(scoreClass(score)).toBe(expected);
  });
});
