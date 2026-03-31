import { describe, it, expect } from 'vitest';
import { validateCheckout, buildSquareLineItems } from './checkout';

describe('validateCheckout', () => {
  const validItem = { type: 'tea' as const, id: 'tea-a', name: 'A', category: 'Green Tea', ounces: 2, pricePerOz: 3.50 };

  it('rejects empty cart', () => {
    const result = validateCheckout({ items: [], customer: { name: 'A', email: 'a@b.com' }, token: 'tok' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects missing customer name', () => {
    const result = validateCheckout({ items: [validItem], customer: { name: '', email: 'a@b.com' }, token: 'tok' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects missing email', () => {
    const result = validateCheckout({ items: [validItem], customer: { name: 'A', email: '' }, token: 'tok' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing payment token', () => {
    const result = validateCheckout({ items: [validItem], customer: { name: 'A', email: 'a@b.com' }, token: '' });
    expect(result.valid).toBe(false);
  });

  it('accepts valid checkout', () => {
    const result = validateCheckout({ items: [validItem], customer: { name: 'A', email: 'a@b.com' }, token: 'tok' });
    expect(result.valid).toBe(true);
  });
});

describe('buildSquareLineItems', () => {
  it('maps tea to line item with ounces as quantity', () => {
    const items = buildSquareLineItems([
      { type: 'tea', id: 'tea-a', name: 'Jasmine Pearl', category: 'Green Tea', ounces: 3, pricePerOz: 4.50 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Jasmine Pearl (3 oz)',
      quantity: '3',
      basePriceMoney: { amount: BigInt(450), currency: 'USD' },
    });
  });

  it('maps drink with customization note', () => {
    const items = buildSquareLineItems([
      {
        type: 'drink', id: 'drink-pc', name: 'Pina Colada', qty: 2, size: '16oz', price: 7.00,
        options: { boba: 'tapioca', milk: 'nondairy', sweetness: 'half', whip: true },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Pina Colada (16oz)');
    expect(items[0].quantity).toBe('2');
    expect(items[0].note).toContain('tapioca');
  });

  it('maps product to line item', () => {
    const items = buildSquareLineItems([
      { type: 'product', id: 'product-mug', name: 'Ceramic Mug', category: 'Art', qty: 1, price: 32.00 },
    ]);
    expect(items[0]).toMatchObject({
      name: 'Ceramic Mug',
      quantity: '1',
      basePriceMoney: { amount: BigInt(3200), currency: 'USD' },
    });
  });
});
