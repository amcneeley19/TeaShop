import { describe, it, expect, beforeEach } from 'vitest';
import { createCart } from './cart';
import type { CartStorage, CartNotifier, TeaCartItem, DrinkCartItem, ProductCartItem } from './cart';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeStorage(): CartStorage & { _data: any } {
  let data: any = null;
  return {
    load: () => data,
    save: (items: any) => { data = items; },
    get _data() { return data; },
  };
}

function makeNotifier(): CartNotifier & { callCount: number } {
  let count = 0;
  return {
    notify: () => { count++; },
    get callCount() { return count; },
  };
}

// ─── Sample items ─────────────────────────────────────────────────────────────

const TEA_ITEM: TeaCartItem = {
  type: 'tea',
  id: 'green-tea',
  name: 'Green Tea',
  category: 'green',
  ounces: 4,
  pricePerOz: 1.5,
};

const DRINK_ITEM: DrinkCartItem = {
  type: 'drink',
  id: 'boba-latte',
  name: 'Boba Latte',
  qty: 1,
  size: '12oz',
  price: 5.5,
  options: {
    boba: 'tapioca',
    milk: 'dairy',
    sweetness: 'full',
    whip: false,
  },
};

const PRODUCT_ITEM: ProductCartItem = {
  type: 'product',
  id: 'teapot-classic',
  name: 'Classic Teapot',
  category: 'teaware',
  qty: 1,
  price: 24.99,
};

// ─── Cycle 1: Tea addItem ─────────────────────────────────────────────────────

describe('Cart — tea addItem (Cycle 1)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('adds a tea item to an empty cart', () => {
    cart.addItem(TEA_ITEM);
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(TEA_ITEM);
  });

  it('merges ounces when adding the same tea id again', () => {
    cart.addItem(TEA_ITEM);
    cart.addItem({ ...TEA_ITEM, ounces: 3 });
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect((items[0] as TeaCartItem).ounces).toBe(7);
  });

  it('caps merged tea ounces at 16', () => {
    cart.addItem({ ...TEA_ITEM, ounces: 10 });
    cart.addItem({ ...TEA_ITEM, ounces: 10 });
    const items = cart.getCart();
    expect((items[0] as TeaCartItem).ounces).toBe(16);
  });

  it('throws when tea ounces is 0', () => {
    expect(() => cart.addItem({ ...TEA_ITEM, ounces: 0 })).toThrow();
  });

  it('throws when tea ounces is negative', () => {
    expect(() => cart.addItem({ ...TEA_ITEM, ounces: -1 })).toThrow();
  });

  it('throws when tea ounces exceeds 16', () => {
    expect(() => cart.addItem({ ...TEA_ITEM, ounces: 17 })).toThrow();
  });
});

// ─── Cycle 2: Drink + Product addItem ─────────────────────────────────────────

describe('Cart — drink addItem (Cycle 2)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('adds a drink item to an empty cart', () => {
    cart.addItem(DRINK_ITEM);
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(DRINK_ITEM);
  });

  it('merges qty when adding the same drink id again', () => {
    cart.addItem(DRINK_ITEM);
    cart.addItem({ ...DRINK_ITEM, qty: 2 });
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect((items[0] as DrinkCartItem).qty).toBe(3);
  });

  it('caps merged drink qty at 10', () => {
    cart.addItem({ ...DRINK_ITEM, qty: 6 });
    cart.addItem({ ...DRINK_ITEM, qty: 6 });
    const items = cart.getCart();
    expect((items[0] as DrinkCartItem).qty).toBe(10);
  });

  it('throws when drink qty exceeds 10', () => {
    expect(() => cart.addItem({ ...DRINK_ITEM, qty: 11 })).toThrow();
  });

  it('throws when drink qty is 0', () => {
    expect(() => cart.addItem({ ...DRINK_ITEM, qty: 0 })).toThrow();
  });
});

describe('Cart — product addItem (Cycle 2)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('adds a product item to an empty cart', () => {
    cart.addItem(PRODUCT_ITEM);
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(PRODUCT_ITEM);
  });

  it('merges qty when adding the same product id again', () => {
    cart.addItem(PRODUCT_ITEM);
    cart.addItem({ ...PRODUCT_ITEM, qty: 3 });
    const items = cart.getCart();
    expect(items).toHaveLength(1);
    expect((items[0] as ProductCartItem).qty).toBe(4);
  });

  it('caps merged product qty at 10', () => {
    cart.addItem({ ...PRODUCT_ITEM, qty: 7 });
    cart.addItem({ ...PRODUCT_ITEM, qty: 7 });
    const items = cart.getCart();
    expect((items[0] as ProductCartItem).qty).toBe(10);
  });

  it('throws when product qty exceeds 10', () => {
    expect(() => cart.addItem({ ...PRODUCT_ITEM, qty: 11 })).toThrow();
  });

  it('throws when product qty is 0', () => {
    expect(() => cart.addItem({ ...PRODUCT_ITEM, qty: 0 })).toThrow();
  });
});

// ─── Cycle 3: removeItem, updateItem, getSubtotal, getItemCount, clearCart ────

describe('Cart — removeItem (Cycle 3)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('removes an item by id', () => {
    cart.addItem(TEA_ITEM);
    cart.removeItem('green-tea');
    expect(cart.getCart()).toHaveLength(0);
  });

  it('is a no-op when id not found', () => {
    cart.addItem(TEA_ITEM);
    cart.removeItem('nonexistent');
    expect(cart.getCart()).toHaveLength(1);
  });
});

describe('Cart — updateItem (Cycle 3)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('updates tea ounces', () => {
    cart.addItem(TEA_ITEM);
    cart.updateItem('green-tea', { ounces: 8 });
    expect((cart.getCart()[0] as TeaCartItem).ounces).toBe(8);
  });

  it('throws when updating tea ounces to 0', () => {
    cart.addItem(TEA_ITEM);
    expect(() => cart.updateItem('green-tea', { ounces: 0 })).toThrow();
  });

  it('throws when updating tea ounces above 16', () => {
    cart.addItem(TEA_ITEM);
    expect(() => cart.updateItem('green-tea', { ounces: 17 })).toThrow();
  });

  it('updates drink qty', () => {
    cart.addItem(DRINK_ITEM);
    cart.updateItem('boba-latte', { qty: 4 });
    expect((cart.getCart()[0] as DrinkCartItem).qty).toBe(4);
  });

  it('throws when updating drink qty above 10', () => {
    cart.addItem(DRINK_ITEM);
    expect(() => cart.updateItem('boba-latte', { qty: 11 })).toThrow();
  });

  it('throws when updating drink qty to 0', () => {
    cart.addItem(DRINK_ITEM);
    expect(() => cart.updateItem('boba-latte', { qty: 0 })).toThrow();
  });

  it('updates drink size', () => {
    cart.addItem(DRINK_ITEM);
    cart.updateItem('boba-latte', { size: '16oz' });
    expect((cart.getCart()[0] as DrinkCartItem).size).toBe('16oz');
  });

  it('updates product qty', () => {
    cart.addItem(PRODUCT_ITEM);
    cart.updateItem('teapot-classic', { qty: 5 });
    expect((cart.getCart()[0] as ProductCartItem).qty).toBe(5);
  });

  it('updates price', () => {
    cart.addItem(PRODUCT_ITEM);
    cart.updateItem('teapot-classic', { price: 19.99 });
    expect((cart.getCart()[0] as ProductCartItem).price).toBe(19.99);
  });
});

describe('Cart — getSubtotal (Cycle 3)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('returns 0 for empty cart', () => {
    expect(cart.getSubtotal()).toBe(0);
  });

  it('calculates tea subtotal as ounces * pricePerOz', () => {
    cart.addItem(TEA_ITEM); // 4 oz * $1.50
    expect(cart.getSubtotal()).toBeCloseTo(6.0);
  });

  it('calculates drink subtotal as qty * price', () => {
    cart.addItem({ ...DRINK_ITEM, qty: 2, price: 5.5 });
    expect(cart.getSubtotal()).toBeCloseTo(11.0);
  });

  it('calculates product subtotal as qty * price', () => {
    cart.addItem({ ...PRODUCT_ITEM, qty: 2, price: 24.99 });
    expect(cart.getSubtotal()).toBeCloseTo(49.98);
  });

  it('sums all item types together', () => {
    cart.addItem(TEA_ITEM);      // 4 * 1.5 = 6.0
    cart.addItem(DRINK_ITEM);    // 1 * 5.5 = 5.5
    cart.addItem(PRODUCT_ITEM);  // 1 * 24.99 = 24.99
    expect(cart.getSubtotal()).toBeCloseTo(36.49);
  });
});

describe('Cart — getItemCount (Cycle 3)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('returns 0 for empty cart', () => {
    expect(cart.getItemCount()).toBe(0);
  });

  it('counts number of distinct line items, not sum of quantities', () => {
    cart.addItem(TEA_ITEM);
    cart.addItem(DRINK_ITEM);
    cart.addItem(PRODUCT_ITEM);
    expect(cart.getItemCount()).toBe(3);
  });

  it('does not increase count when merging', () => {
    cart.addItem(TEA_ITEM);
    cart.addItem({ ...TEA_ITEM, ounces: 2 });
    expect(cart.getItemCount()).toBe(1);
  });
});

describe('Cart — clearCart (Cycle 3)', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  it('empties the cart', () => {
    cart.addItem(TEA_ITEM);
    cart.addItem(DRINK_ITEM);
    cart.clearCart();
    expect(cart.getCart()).toHaveLength(0);
  });

  it('getSubtotal returns 0 after clear', () => {
    cart.addItem(TEA_ITEM);
    cart.clearCart();
    expect(cart.getSubtotal()).toBe(0);
  });
});

// ─── Cycle 4: Persistence and Notification ────────────────────────────────────

describe('Cart — persistence (Cycle 4)', () => {
  it('saves to storage on addItem', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    expect(storage._data).not.toBeNull();
    expect(storage._data).toHaveLength(1);
  });

  it('saves to storage on removeItem', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    cart.removeItem('green-tea');
    expect(storage._data).toHaveLength(0);
  });

  it('saves to storage on updateItem', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    cart.updateItem('green-tea', { ounces: 8 });
    expect((storage._data[0] as TeaCartItem).ounces).toBe(8);
  });

  it('saves to storage on clearCart', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    cart.clearCart();
    expect(storage._data).toHaveLength(0);
  });

  it('loads existing items from storage on creation', () => {
    const storage = makeStorage();
    // Pre-populate storage
    storage.save([TEA_ITEM]);
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    expect(cart.getCart()).toHaveLength(1);
    expect(cart.getCart()[0]).toEqual(TEA_ITEM);
  });

  it('handles corrupted/null storage gracefully', () => {
    const storage: CartStorage = {
      load: () => null,
      save: () => {},
    };
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    expect(cart.getCart()).toHaveLength(0);
  });

  it('handles corrupted storage that throws gracefully', () => {
    const storage: CartStorage = {
      load: () => { throw new Error('storage error'); },
      save: () => {},
    };
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    expect(cart.getCart()).toHaveLength(0);
  });
});

describe('Cart — notifications (Cycle 4)', () => {
  it('notifies on addItem', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    expect(notifier.callCount).toBe(1);
  });

  it('notifies on removeItem when item exists', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    const countBefore = notifier.callCount;
    cart.removeItem('green-tea');
    expect(notifier.callCount).toBe(countBefore + 1);
  });

  it('does not notify on removeItem when item not found', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    const countBefore = notifier.callCount;
    cart.removeItem('nonexistent');
    expect(notifier.callCount).toBe(countBefore);
  });

  it('notifies on updateItem', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    const countBefore = notifier.callCount;
    cart.updateItem('green-tea', { ounces: 8 });
    expect(notifier.callCount).toBe(countBefore + 1);
  });

  it('notifies on clearCart', () => {
    const storage = makeStorage();
    const notifier = makeNotifier();
    const cart = createCart(storage, notifier);
    cart.addItem(TEA_ITEM);
    const countBefore = notifier.callCount;
    cart.clearCart();
    expect(notifier.callCount).toBe(countBefore + 1);
  });
});
