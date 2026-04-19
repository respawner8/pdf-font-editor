import { describe, it, expect } from 'vitest';
import { lookupRegistry } from '@/fonts/registry';

describe('lookupRegistry', () => {
  it('maps Helvetica-Bold to Arimo Bold', () => {
    const hit = lookupRegistry('Helvetica-Bold');
    expect(hit?.family).toBe('Arimo');
    expect(hit?.weight).toBe(700);
  });
  it('maps Times variants to Tinos', () => {
    expect(lookupRegistry('TimesNewRomanPSMT')?.family).toBe('Tinos');
    expect(lookupRegistry('Times-Italic')?.family).toBe('Tinos');
    expect(lookupRegistry('Times-Italic')?.italic).toBe(true);
  });
  it('is case-insensitive and strips subset prefixes', () => {
    expect(lookupRegistry('ABCDEF+Helvetica')?.family).toBe('Arimo');
    expect(lookupRegistry('arial-BoldMT')?.family).toBe('Arimo');
  });
  it('returns undefined for unknown names', () => {
    expect(lookupRegistry('RandomCustomFont')).toBeUndefined();
  });
});
