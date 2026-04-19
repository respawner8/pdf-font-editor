import { describe, it, expect } from 'vitest';
import { classifyFont, inferWeight, inferItalic, inferItalicFromFlags } from '@/fonts/analyzer';

describe('classifyFont', () => {
  it('classifies serif from PostScript name', () => {
    expect(classifyFont('TimesNewRomanPSMT', 0)).toBe('serif');
    expect(classifyFont('Georgia-Bold', 0)).toBe('serif');
  });
  it('classifies sans from PostScript name', () => {
    expect(classifyFont('Helvetica-Bold', 0)).toBe('sans');
    expect(classifyFont('Arial', 0)).toBe('sans');
    expect(classifyFont('Calibri', 0)).toBe('sans');
  });
  it('classifies mono from flag bit 1 (FixedPitch)', () => {
    expect(classifyFont('UnknownFont', 0b1)).toBe('mono');
  });
  it('falls back to unknown when no signal', () => {
    expect(classifyFont('CustomCo-Display', 0)).toBe('unknown');
  });
});

describe('inferWeight', () => {
  it('extracts weight hints from the PS name', () => {
    expect(inferWeight('Helvetica-Bold')).toBe(700);
    expect(inferWeight('Helvetica-Light')).toBe(300);
    expect(inferWeight('Helvetica-Black')).toBe(900);
    expect(inferWeight('Helvetica')).toBe(400);
  });
});

describe('inferItalic', () => {
  it('detects italic / oblique in PS name', () => {
    expect(inferItalic('Helvetica-Oblique')).toBe(true);
    expect(inferItalic('Times-Italic')).toBe(true);
    expect(inferItalic('Helvetica-Bold')).toBe(false);
  });
});

describe('inferItalicFromFlags', () => {
  it('detects italic flag (bit 7 of Flags)', () => {
    expect(inferItalicFromFlags(1 << 6)).toBe(true);
    expect(inferItalicFromFlags(0)).toBe(false);
  });
});
