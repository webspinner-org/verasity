import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, api } from '../helpers/load-app.js';

describe('computeScrubStats (v5)', () => {
  let a;

  beforeEach(() => {
    a = api(loadApp());
  });

  it('returns zero counts and null coverage for empty input', () => {
    expect(a.computeScrubStats('')).toEqual({
      supported: 0, uncovered: 0, contradicted: 0, coverage: null
    });
  });

  it('returns zero counts and null coverage for null input', () => {
    expect(a.computeScrubStats(null)).toEqual({
      supported: 0, uncovered: 0, contradicted: 0, coverage: null
    });
  });

  it('counts a single supported tag', () => {
    const stats = a.computeScrubStats('The JWST <supported>launched in December 2021</supported>.');
    expect(stats.supported).toBe(1);
    expect(stats.uncovered).toBe(0);
    expect(stats.contradicted).toBe(0);
  });

  it('counts uncovered tags', () => {
    const stats = a.computeScrubStats('<uncovered>One</uncovered> <uncovered>Two</uncovered>');
    expect(stats.uncovered).toBe(2);
  });

  it('counts contradicted tags', () => {
    const stats = a.computeScrubStats('<contradicted>Wrong fact</contradicted>');
    expect(stats.contradicted).toBe(1);
  });

  it('counts a mix of all three', () => {
    const text = '<supported>A</supported> <uncovered>B</uncovered> <contradicted>C</contradicted> <supported>D</supported>';
    const stats = a.computeScrubStats(text);
    expect(stats.supported).toBe(2);
    expect(stats.uncovered).toBe(1);
    expect(stats.contradicted).toBe(1);
  });

  it('coverage is supported / (supported + uncovered + contradicted)', () => {
    const text = '<supported>A</supported> <supported>B</supported> <uncovered>C</uncovered> <contradicted>D</contradicted>';
    const stats = a.computeScrubStats(text);
    expect(stats.coverage).toBeCloseTo(0.5, 5);
  });

  it('coverage is 1.0 when every tagged claim is supported', () => {
    const stats = a.computeScrubStats('<supported>A</supported> <supported>B</supported>');
    expect(stats.coverage).toBe(1);
  });

  it('coverage is 0 when no claim is supported but some are tagged', () => {
    const stats = a.computeScrubStats('<contradicted>A</contradicted>');
    expect(stats.coverage).toBe(0);
  });

  it('ignores spin/dispute tags from the prior synthesis', () => {
    const text = '<spin>x</spin> <dispute>y</dispute> <supported>z</supported>';
    const stats = a.computeScrubStats(text);
    expect(stats.supported).toBe(1);
    expect(stats.uncovered).toBe(0);
    expect(stats.contradicted).toBe(0);
  });

  it('is case-insensitive on tag names', () => {
    const stats = a.computeScrubStats('<SUPPORTED>A</SUPPORTED> <Contradicted>B</Contradicted>');
    expect(stats.supported).toBe(1);
    expect(stats.contradicted).toBe(1);
  });
});
