import { describe, it, expect } from 'vitest';
import { slugify, parsePrice } from './utils';

describe('slugify', () => {
  it('creates id from prefix and simple name', () => {
    expect(slugify('tea', 'Jasmine Pearl')).toBe('tea-jasmine-pearl');
  });

  it('handles parentheses and special characters', () => {
    expect(slugify('tea', 'Dragon Well (Longjing)')).toBe('tea-dragon-well-longjing');
  });

  it('handles multiple parts', () => {
    expect(slugify('drink', 'Pina Colada', '16oz', 'tapioca')).toBe('drink-pina-colada-16oz-tapioca');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('tea', 'Earl   Grey')).toBe('tea-earl-grey');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('product', ' Ceramic Mug ')).toBe('product-ceramic-mug');
  });
});

describe('parsePrice', () => {
  it('strips dollar sign and returns number', () => {
    expect(parsePrice('$14.00')).toBe(14);
  });

  it('handles price without dollar sign', () => {
    expect(parsePrice('8.50')).toBe(8.5);
  });

  it('returns 0 for empty string', () => {
    expect(parsePrice('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parsePrice('free')).toBe(0);
  });
});
