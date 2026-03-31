import type { CartItem, TeaCartItem, DrinkCartItem, ProductCartItem } from './cart';

export type CheckoutRequest = {
  items: CartItem[];
  customer: { name: string; email: string; phone?: string };
  token: string;
};

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateCheckout(req: CheckoutRequest): ValidationResult {
  if (!req.items || req.items.length === 0) return { valid: false, error: 'Cart is empty' };
  if (!req.customer?.name?.trim()) return { valid: false, error: 'Customer name is required' };
  if (!req.customer?.email?.trim()) return { valid: false, error: 'Customer email is required' };
  if (!req.token?.trim()) return { valid: false, error: 'Payment token is required' };
  return { valid: true };
}

type SquareLineItem = {
  name: string;
  quantity: string;
  basePriceMoney: { amount: bigint; currency: string };
  note?: string;
};

function dollarsToCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

export function buildSquareLineItems(items: CartItem[]): SquareLineItem[] {
  return items.map(item => {
    if (item.type === 'tea') {
      const tea = item as TeaCartItem;
      return {
        name: `${tea.name} (${tea.ounces} oz)`,
        quantity: String(tea.ounces),
        basePriceMoney: { amount: dollarsToCents(tea.pricePerOz), currency: 'USD' },
      };
    }
    if (item.type === 'drink') {
      const drink = item as DrinkCartItem;
      const opts = drink.options;
      const note = `${opts.boba} boba, ${opts.milk}, ${opts.sweetness} sweet${opts.whip ? ', whipped cream' : ''}`;
      return {
        name: `${drink.name} (${drink.size})`,
        quantity: String(drink.qty),
        basePriceMoney: { amount: dollarsToCents(drink.price), currency: 'USD' },
        note,
      };
    }
    // product
    const product = item as ProductCartItem;
    return {
      name: product.name,
      quantity: String(product.qty),
      basePriceMoney: { amount: dollarsToCents(product.price), currency: 'USD' },
    };
  });
}
