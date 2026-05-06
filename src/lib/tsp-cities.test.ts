import { describe, it, expect } from 'vitest';
import { TURKISH_CITIES, findCity } from './tsp-cities';

describe('TURKISH_CITIES', () => {
  it('contains at least 20 cities', () => {
    expect(TURKISH_CITIES.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry has a non-empty label and finite coordinates', () => {
    for (const c of TURKISH_CITIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
  });

  it('coordinates fall within Türkiye bounding box (roughly 26-45 lon, 35-43 lat)', () => {
    for (const c of TURKISH_CITIES) {
      expect(c.x).toBeGreaterThanOrEqual(25);
      expect(c.x).toBeLessThanOrEqual(46);
      expect(c.y).toBeGreaterThanOrEqual(35);
      expect(c.y).toBeLessThanOrEqual(43);
    }
  });

  it('labels are unique (case-insensitive)', () => {
    const lower = TURKISH_CITIES.map((c) => c.label.toLocaleLowerCase('tr'));
    expect(new Set(lower).size).toBe(lower.length);
  });
});

describe('findCity', () => {
  it('finds a city by exact label', () => {
    const c = findCity('İstanbul');
    expect(c?.label).toBe('İstanbul');
    expect(c?.x).toBeCloseTo(28.98);
  });

  it('is case insensitive (Turkish)', () => {
    expect(findCity('istanbul')?.label).toBe('İstanbul');
    expect(findCity('ANKARA')?.label).toBe('Ankara');
  });

  it('trims whitespace', () => {
    expect(findCity('  Bursa  ')?.label).toBe('Bursa');
  });

  it('returns undefined for unknown city', () => {
    expect(findCity('Atlantis')).toBeUndefined();
  });
});
