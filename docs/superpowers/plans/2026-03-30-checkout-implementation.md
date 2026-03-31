# Checkout Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full shopping cart and checkout experience where customers can buy loose leaf teas by the ounce, boba drinks with customizations, and shop products by quantity — paying via embedded Square.

**Architecture:** Pure TypeScript cart module with dependency injection (testable without jsdom). Cart state in localStorage, custom events for UI reactivity. Astro API route for Square payment processing. All business logic TDD'd with Vitest.

**Tech Stack:** Astro 6, TypeScript, Vitest, Square Web Payments SDK (frontend), Square Node SDK (backend)

---

## File Structure

```
src/
├── lib/
│   ├── cart.ts              # Cart business logic (pure TS, DI)
│   ├── cart.test.ts         # Cart unit tests
│   ├── utils.ts             # slugify(), parsePrice()
│   └── utils.test.ts        # Utils unit tests
├── data/
│   ├── menu.json            # MODIFY: add pricePerOz to each tea
│   ├── drinks.json          # CREATE: extract drinks from infinite-menu.astro + pricing
│   └── products.json        # NO CHANGE (prices parsed at runtime)
├── components/
│   ├── CartDrawer.astro     # CREATE: slide-in cart panel
│   ├── CartButton.astro     # MODIFY: wire to real cart state
│   ├── TeaList.astro        # MODIFY: add oz stepper + add-to-cart
│   ├── ShopGrid.astro       # MODIFY: add qty stepper + real cart
│   └── Header.astro         # MODIFY: include CartDrawer
├── pages/
│   ├── infinite-menu.astro  # MODIFY: add size/customization + add-to-cart
│   ├── checkout.astro       # CREATE: checkout page with Square SDK
│   └── api/
│       └── checkout.ts      # CREATE: Square payment API route
├── lib/
│   └── checkout.ts          # CREATE: checkout validation + line item builder
├── styles/
│   └── global.css           # NO CHANGE
vitest.config.ts              # CREATE
astro.config.mjs              # MODIFY: output "hybrid", add @astrojs/node adapter
package.json                  # MODIFY: add vitest, square, @astrojs/node deps + test scripts
.env.example                  # CREATE: env var template
```

---

## Task 1: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: "No test files found" (clean exit)

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest test framework"
```

---

## Task 2: TDD Utils Module — slugify & parsePrice

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/utils.test.ts`

- [ ] **Step 1: Write failing tests for slugify**

Create `src/lib/utils.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — "Cannot find module './utils'"

- [ ] **Step 3: Implement utils.ts**

Create `src/lib/utils.ts`:
```typescript
export function slugify(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add slugify and parsePrice utilities with tests"
```

---

## Task 3: TDD Cart Module — Types & Core Operations

**Files:**
- Create: `src/lib/cart.ts`
- Create: `src/lib/cart.test.ts`

This is the largest task. We build the cart in **incremental red-green cycles** — not all tests at once.

- [ ] **Step 1: Create test file with first cycle — addItem tea tests only**

Create `src/lib/cart.test.ts` with ONLY the tea-related addItem tests and the test helpers (makeStorage, makeNotifier, beforeEach). The rest of the tests are added in subsequent cycles.

Create `src/lib/cart.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createCart, type TeaCartItem, type DrinkCartItem, type ProductCartItem } from './cart';

function makeStorage() {
  let data: any = null;
  return {
    load: () => data,
    save: (items: any) => { data = items; },
  };
}

function makeNotifier() {
  let count = 0;
  return {
    notify: () => { count++; },
    get callCount() { return count; },
  };
}

describe('cart', () => {
  let storage: ReturnType<typeof makeStorage>;
  let notifier: ReturnType<typeof makeNotifier>;
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    storage = makeStorage();
    notifier = makeNotifier();
    cart = createCart(storage, notifier);
  });

  describe('addItem - tea', () => {
    it('adds a tea item to the cart', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-jasmine-pearl', name: 'Jasmine Pearl',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      };
      cart.addItem(tea);
      expect(cart.getCart()).toHaveLength(1);
      expect(cart.getCart()[0]).toMatchObject({ name: 'Jasmine Pearl', ounces: 2 });
    });

    it('merges ounces for same tea', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-jasmine-pearl', name: 'Jasmine Pearl',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      };
      cart.addItem(tea);
      cart.addItem({ ...tea, ounces: 3 });
      expect(cart.getCart()).toHaveLength(1);
      expect(cart.getCart()[0]).toMatchObject({ ounces: 5 });
    });

    it('caps merged ounces at 16', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-jasmine-pearl', name: 'Jasmine Pearl',
        category: 'Green Tea', ounces: 10, pricePerOz: 3.50,
      };
      cart.addItem(tea);
      cart.addItem({ ...tea, ounces: 10 });
      expect(cart.getCart()[0]).toMatchObject({ ounces: 16 });
    });

    it('throws on 0 ounces', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: 0, pricePerOz: 3.50,
      };
      expect(() => cart.addItem(tea)).toThrow();
    });

    it('throws on negative ounces', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: -1, pricePerOz: 3.50,
      };
      expect(() => cart.addItem(tea)).toThrow();
    });

    it('throws on ounces > 16', () => {
      const tea: TeaCartItem = {
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: 17, pricePerOz: 3.50,
      };
      expect(() => cart.addItem(tea)).toThrow();
    });
  });

  describe('addItem - drink', () => {
    it('adds a drink with customizations', () => {
      const drink: DrinkCartItem = {
        type: 'drink', id: 'drink-pina-colada-16oz', name: 'Pina Colada',
        qty: 1, size: '16oz', price: 7.00,
        options: { boba: 'tapioca', milk: 'dairy', sweetness: 'full', whip: true },
      };
      cart.addItem(drink);
      expect(cart.getCart()).toHaveLength(1);
      expect(cart.getCart()[0]).toMatchObject({ name: 'Pina Colada', size: '16oz' });
    });

    it('merges qty for identical drink', () => {
      const drink: DrinkCartItem = {
        type: 'drink', id: 'drink-pina-colada-16oz', name: 'Pina Colada',
        qty: 1, size: '16oz', price: 7.00,
        options: { boba: 'tapioca', milk: 'dairy', sweetness: 'full', whip: true },
      };
      cart.addItem(drink);
      cart.addItem({ ...drink });
      expect(cart.getCart()).toHaveLength(1);
      expect(cart.getCart()[0]).toMatchObject({ qty: 2 });
    });

    it('throws on qty > 10', () => {
      const drink: DrinkCartItem = {
        type: 'drink', id: 'drink-test', name: 'Test',
        qty: 11, size: '12oz', price: 5.50,
        options: { boba: 'none', milk: 'dairy', sweetness: 'full', whip: false },
      };
      expect(() => cart.addItem(drink)).toThrow();
    });
  });

  describe('addItem - product', () => {
    it('adds a product', () => {
      const product: ProductCartItem = {
        type: 'product', id: 'product-ceramic-mug', name: 'Ceramic Mug',
        category: 'Art', qty: 1, price: 32.00,
      };
      cart.addItem(product);
      expect(cart.getCart()).toHaveLength(1);
    });

    it('merges qty for same product', () => {
      const product: ProductCartItem = {
        type: 'product', id: 'product-ceramic-mug', name: 'Ceramic Mug',
        category: 'Art', qty: 1, price: 32.00,
      };
      cart.addItem(product);
      cart.addItem({ ...product });
      expect(cart.getCart()).toHaveLength(1);
      expect(cart.getCart()[0]).toMatchObject({ qty: 2 });
    });

    it('throws on qty > 10', () => {
      const product: ProductCartItem = {
        type: 'product', id: 'product-test', name: 'Test',
        category: 'Art', qty: 11, price: 10,
      };
      expect(() => cart.addItem(product)).toThrow();
    });
  });

  describe('removeItem', () => {
    it('removes an item by id', () => {
      cart.addItem({
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      cart.removeItem('tea-test');
      expect(cart.getCart()).toHaveLength(0);
    });

    it('no-op for nonexistent id', () => {
      expect(() => cart.removeItem('nope')).not.toThrow();
    });
  });

  describe('updateItem', () => {
    it('updates tea ounces', () => {
      cart.addItem({
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      cart.updateItem('tea-test', { ounces: 5 });
      expect(cart.getCart()[0]).toMatchObject({ ounces: 5 });
    });

    it('updates product qty', () => {
      cart.addItem({
        type: 'product', id: 'product-mug', name: 'Mug',
        category: 'Art', qty: 1, price: 32,
      });
      cart.updateItem('product-mug', { qty: 3 });
      expect(cart.getCart()[0]).toMatchObject({ qty: 3 });
    });

    it('throws on invalid update values', () => {
      cart.addItem({
        type: 'tea', id: 'tea-test', name: 'Test',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      expect(() => cart.updateItem('tea-test', { ounces: 0 })).toThrow();
      expect(() => cart.updateItem('tea-test', { ounces: 17 })).toThrow();
    });
  });

  describe('getSubtotal', () => {
    it('calculates total across mixed item types', () => {
      cart.addItem({
        type: 'tea', id: 'tea-jp', name: 'JP',
        category: 'Green Tea', ounces: 2, pricePerOz: 4.50,
      });
      cart.addItem({
        type: 'drink', id: 'drink-pc', name: 'PC',
        qty: 1, size: '16oz', price: 7.00,
        options: { boba: 'none', milk: 'dairy', sweetness: 'full', whip: false },
      });
      cart.addItem({
        type: 'product', id: 'product-mug', name: 'Mug',
        category: 'Art', qty: 1, price: 32.00,
      });
      // 2*4.50 + 1*7.00 + 1*32.00 = 48.00
      expect(cart.getSubtotal()).toBe(48);
    });
  });

  describe('getItemCount', () => {
    it('returns number of line items, not sum of quantities', () => {
      cart.addItem({
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 4, pricePerOz: 3.50,
      });
      cart.addItem({
        type: 'product', id: 'product-b', name: 'B',
        category: 'Art', qty: 3, price: 10,
      });
      expect(cart.getItemCount()).toBe(2);
    });
  });

  describe('clearCart', () => {
    it('empties the cart', () => {
      cart.addItem({
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      cart.clearCart();
      expect(cart.getCart()).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('saves to storage on every mutation', () => {
      cart.addItem({
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      expect(storage.load()).toHaveLength(1);
    });

    it('loads from storage on first getCart', () => {
      storage.save([{
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      }]);
      const cart2 = createCart(storage, notifier);
      expect(cart2.getCart()).toHaveLength(1);
    });

    it('handles corrupted storage gracefully', () => {
      storage.save('not an array' as any);
      const cart2 = createCart(storage, notifier);
      expect(cart2.getCart()).toHaveLength(0);
    });
  });

  describe('notifications', () => {
    it('notifies on addItem', () => {
      cart.addItem({
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      expect(notifier.callCount).toBe(1);
    });

    it('notifies on removeItem', () => {
      cart.addItem({
        type: 'tea', id: 'tea-a', name: 'A',
        category: 'Green Tea', ounces: 2, pricePerOz: 3.50,
      });
      cart.removeItem('tea-a');
      expect(notifier.callCount).toBe(2);
    });
  });
});
```

**Note:** The full test file is shown above for reference. When implementing, follow these cycles:

**Cycle 1 (Steps 2-5): Types + addItem tea**
- [ ] **Step 2:** Run tests — verify fail (cannot find module)
- [ ] **Step 3:** Create `src/lib/cart.ts` with types, createCart, and addItem for tea only
- [ ] **Step 4:** Run tests — verify tea addItem tests pass
- [ ] **Step 5:** Commit: `git commit -m "feat: cart module — tea addItem"`

**Cycle 2 (Steps 6-8): addItem drink + product**
- [ ] **Step 6:** Add drink and product addItem tests to cart.test.ts
- [ ] **Step 7:** Implement addItem for drink and product in cart.ts
- [ ] **Step 8:** Run tests — verify all addItem tests pass

**Cycle 3 (Steps 9-11): removeItem, updateItem, getSubtotal, getItemCount, clearCart**
- [ ] **Step 9:** Add removeItem, updateItem, getSubtotal, getItemCount, clearCart tests
- [ ] **Step 10:** Implement those functions
- [ ] **Step 11:** Run tests — verify pass

**Cycle 4 (Steps 12-14): persistence + notifications**
- [ ] **Step 12:** Add persistence and notification tests
- [ ] **Step 13:** Implement storage load/save and notifier.notify() calls
- [ ] **Step 14:** Run all tests — verify ALL pass. Commit: `git commit -m "feat: cart module complete with full test suite"`

The complete implementation of cart.ts is shown below for reference. Implement it incrementally per the cycles above.

Create `src/lib/cart.ts`:
```typescript
import { slugify } from './utils';

export type DrinkOptions = {
  boba: 'tapioca' | 'bursting' | 'none';
  milk: 'dairy' | 'nondairy';
  sweetness: 'full' | 'half' | 'light' | 'none';
  whip: boolean;
};

export type TeaCartItem = {
  type: 'tea';
  id: string;
  name: string;
  category: string;
  ounces: number;
  pricePerOz: number;
};

export type DrinkCartItem = {
  type: 'drink';
  id: string;
  name: string;
  qty: number;
  size: '12oz' | '16oz';
  price: number;
  options: DrinkOptions;
};

export type ProductCartItem = {
  type: 'product';
  id: string;
  name: string;
  category: string;
  qty: number;
  price: number;
};

export type CartItem = TeaCartItem | DrinkCartItem | ProductCartItem;

export type CartStorage = {
  load(): CartItem[] | null;
  save(items: CartItem[]): void;
};

export type CartNotifier = {
  notify(): void;
};

const TEA_MAX_OZ = 16;
const QTY_MAX = 10;

function validateTea(item: TeaCartItem) {
  if (item.ounces <= 0 || item.ounces > TEA_MAX_OZ) {
    throw new Error(`Tea ounces must be 1-${TEA_MAX_OZ}, got ${item.ounces}`);
  }
}

function validateQty(qty: number, label: string) {
  if (qty <= 0 || qty > QTY_MAX) {
    throw new Error(`${label} qty must be 1-${QTY_MAX}, got ${qty}`);
  }
}

export function createCart(storage: CartStorage, notifier: CartNotifier) {
  let items: CartItem[] | null = null;

  function load(): CartItem[] {
    if (items === null) {
      const stored = storage.load();
      items = Array.isArray(stored) ? stored : [];
    }
    return items;
  }

  function persist() {
    storage.save(load());
    notifier.notify();
  }

  return {
    addItem(item: CartItem) {
      const cart = load();

      if (item.type === 'tea') {
        validateTea(item);
        const existing = cart.find(i => i.id === item.id) as TeaCartItem | undefined;
        if (existing) {
          existing.ounces = Math.min(existing.ounces + item.ounces, TEA_MAX_OZ);
        } else {
          cart.push({ ...item });
        }
      } else if (item.type === 'drink') {
        validateQty(item.qty, 'Drink');
        const existing = cart.find(i => i.id === item.id) as DrinkCartItem | undefined;
        if (existing) {
          existing.qty = Math.min(existing.qty + item.qty, QTY_MAX);
        } else {
          cart.push({ ...item });
        }
      } else if (item.type === 'product') {
        validateQty(item.qty, 'Product');
        const existing = cart.find(i => i.id === item.id) as ProductCartItem | undefined;
        if (existing) {
          existing.qty = Math.min(existing.qty + item.qty, QTY_MAX);
        } else {
          cart.push({ ...item });
        }
      }

      persist();
    },

    removeItem(id: string) {
      const cart = load();
      const idx = cart.findIndex(i => i.id === id);
      if (idx !== -1) {
        cart.splice(idx, 1);
      }
      persist();
    },

    updateItem(id: string, changes: Partial<CartItem>) {
      const cart = load();
      const item = cart.find(i => i.id === id);
      if (!item) return;

      if (item.type === 'tea' && 'ounces' in changes) {
        const oz = changes.ounces as number;
        if (oz <= 0 || oz > TEA_MAX_OZ) {
          throw new Error(`Tea ounces must be 1-${TEA_MAX_OZ}, got ${oz}`);
        }
        item.ounces = oz;
      }

      if ((item.type === 'drink' || item.type === 'product') && 'qty' in changes) {
        const qty = changes.qty as number;
        validateQty(qty, item.type);
        (item as DrinkCartItem | ProductCartItem).qty = qty;
      }

      if (item.type === 'drink' && 'price' in changes) {
        (item as DrinkCartItem).price = changes.price as number;
      }

      if (item.type === 'drink' && 'size' in changes) {
        (item as DrinkCartItem).size = (changes as any).size;
      }

      persist();
    },

    getCart(): CartItem[] {
      return [...load()];
    },

    getSubtotal(): number {
      return load().reduce((sum, item) => {
        if (item.type === 'tea') return sum + item.ounces * item.pricePerOz;
        if (item.type === 'drink') return sum + item.qty * item.price;
        if (item.type === 'product') return sum + item.qty * item.price;
        return sum;
      }, 0);
    },

    getItemCount(): number {
      return load().length;
    },

    clearCart() {
      items = [];
      persist();
    },
  };
}
```

*(Commit happens at end of Cycle 4 above)*

---

## Task 4: Add Pricing to Data Files

**Files:**
- Modify: `src/data/menu.json` — add `pricePerOz: 3.50` to every tea
- Create: `src/data/drinks.json` — extract 29 drinks from infinite-menu.astro + add price12/price16
- Modify: `src/pages/infinite-menu.astro` — import from drinks.json instead of inline

- [ ] **Step 1: Add pricePerOz to every tea in menu.json**

Read `src/data/menu.json`. For every tea object, add `"pricePerOz": 3.50` as a new field. This is a placeholder price.

- [ ] **Step 2: Create drinks.json**

Create `src/data/drinks.json` with all 29 drinks from the current `infinite-menu.astro` frontmatter. Add pricing fields:
```json
[
  { "name": "Birthday", "desc": "vanilla black tea, brown sugar, cream with sprinkles", "base": "Black Tea", "price12": 5.50, "price16": 7.00 },
  ...all 29 drinks...
]
```

- [ ] **Step 3: Update infinite-menu.astro to import from drinks.json**

Replace the inline `const drinks = [...]` with:
```typescript
import drinks from '../data/drinks.json';
```

Remove the hardcoded drinks array from the frontmatter.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: 7 pages built successfully

- [ ] **Step 5: Commit**

```bash
git add src/data/menu.json src/data/drinks.json src/pages/infinite-menu.astro
git commit -m "feat: add pricing to teas and drinks data"
```

---

## Task 5: Cart Browser Integration

**Files:**
- Create: `src/lib/cart-browser.ts` — browser-specific cart initialization

- [ ] **Step 1: Create cart-browser.ts**

This file creates the cart instance for browser use with localStorage and CustomEvent:

```typescript
import { createCart, type CartStorage, type CartNotifier } from './cart';

const STORAGE_KEY = 'tea-shop-cart';

const browserStorage: CartStorage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // quota exceeded — cart still works in memory
    }
  },
};

const browserNotifier: CartNotifier = {
  notify() {
    window.dispatchEvent(new CustomEvent('cart-updated'));
  },
};

export const cart = createCart(browserStorage, browserNotifier);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cart-browser.ts
git commit -m "feat: add browser cart integration with localStorage"
```

---

## Task 6: Enhance Tea List with Oz Stepper & Add to Cart

**Files:**
- Modify: `src/components/TeaList.astro`

- [ ] **Step 1: Add oz stepper and add-to-cart to each tea card**

In `TeaList.astro`, modify each tea card to include:
- A price display showing `$X.XX/oz`
- An ounce stepper (−/+ buttons, value display, 1-16 range)
- Line total display
- "Add to Cart" button

Add a `<script>` section that imports from `cart-browser.ts` and handles:
- Stepper increment/decrement (clamped 1-16)
- Add-to-cart button click → `cart.addItem()` with tea data
- "Added!" feedback animation

- [ ] **Step 2: Build and test manually**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/components/TeaList.astro
git commit -m "feat: add oz stepper and add-to-cart to tea list"
```

---

## Task 7: Enhance Infinite Menu with Size/Customization & Add to Cart

**Files:**
- Modify: `src/pages/infinite-menu.astro`

- [ ] **Step 1: Add size toggle, customization dropdowns, and add-to-cart**

For each drink card, add:
- Size toggle (12oz / 16oz) showing price for each
- Customization dropdowns: boba (tapioca/bursting/none), milk (dairy/nondairy), sweetness (full/half/light/none), whipped cream (yes/no)
- "Add to Cart" button

Add `<script>` that imports `cart-browser.ts` and handles:
- Size toggle → updates displayed price
- Add-to-cart → `cart.addItem()` with drink data including selected options
- Generates drink ID using `slugify('drink', name, size, ...options)`

- [ ] **Step 2: Build and test**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/pages/infinite-menu.astro
git commit -m "feat: add size/customization and add-to-cart to infinite menu"
```

---

## Task 8: Enhance Shop with Qty Stepper & Real Cart

**Files:**
- Modify: `src/components/ShopGrid.astro`

- [ ] **Step 1: Replace fake add-to-cart with real cart integration**

Replace the existing fake cart logic (badge increment only) with:
- Quantity stepper per product (1-10)
- Add-to-cart calls `cart.addItem()` with product data
- Price parsed via `parsePrice()`
- "Added!" feedback

- [ ] **Step 2: Build and test**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/components/ShopGrid.astro
git commit -m "feat: add real cart integration to shop grid"
```

---

## Task 9: Build Cart Drawer

**Files:**
- Create: `src/components/CartDrawer.astro`
- Modify: `src/components/Header.astro` — include CartDrawer

- [ ] **Step 1: Create CartDrawer.astro**

Slide-in panel from right side with:
- Overlay (click to close)
- Header with "Your Cart" title and item count
- Cart items grouped by type, each showing:
  - Tea: name, oz, price/oz, line total, oz adjust buttons, remove
  - Drink: name, size, customizations summary, qty, price, remove
  - Product: name, qty, price, qty adjust buttons, remove
- Subtotal display
- "Checkout" button → `/checkout`
- Empty state when cart has no items
- Accessibility: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close

Script imports `cart-browser.ts` and listens for `cart-updated` events to re-render.

- [ ] **Step 2: Include CartDrawer in Header.astro**

Add `<CartDrawer />` import and include it after the header element. Wire the existing cart button to toggle the drawer open.

- [ ] **Step 3: Wire CartButton.astro to real cart count**

Add a script to CartButton that listens for `cart-updated` and updates the badge count via `cart.getItemCount()`.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 5: Commit**

```bash
git add src/components/CartDrawer.astro src/components/Header.astro src/components/CartButton.astro
git commit -m "feat: add cart drawer with full item management"
```

---

## Task 10: Build Checkout Page

**Files:**
- Create: `src/pages/checkout.astro`

- [ ] **Step 1: Create checkout page**

Single-column layout (max-width 640px) with:
- Order summary section (reads cart, displays all items read-only with line totals)
- Customer info form: name (required), email (required), phone (optional)
- Square Web Payments SDK card input area (div#card-container)
- "Place Order" button
- Loading state (spinner overlay)
- Success/error message display

Script section:
- Loads Square SDK via dynamic script tag
- Initializes card payment method
- On form submit: validates fields, tokenizes card, POSTs to `/api/checkout`
- Handles response (success → show confirmation + clear cart, error → show message)

Square SDK loaded from: `https://sandbox.web.squarecdn.com/v1/square.js`

- [ ] **Step 2: Build and test**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/pages/checkout.astro
git commit -m "feat: add checkout page with Square payment form"
```

---

## Task 11: TDD Checkout API Route

**Files:**
- Create: `src/lib/checkout.ts` — checkout logic (pure function, testable)
- Create: `src/lib/checkout.test.ts`
- Create: `src/pages/api/checkout.ts` — Astro API route (thin wrapper)

- [ ] **Step 1: Write failing tests for checkout logic**

Create `src/lib/checkout.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { validateCheckout, buildSquareLineItems } from './checkout';

describe('validateCheckout', () => {
  it('rejects empty cart', () => {
    const result = validateCheckout({ items: [], customer: { name: 'A', email: 'a@b.com' }, token: 'tok' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects missing customer name', () => {
    const result = validateCheckout({
      items: [{ type: 'tea', id: 'tea-a', name: 'A', category: 'Green Tea', ounces: 2, pricePerOz: 3.50 }],
      customer: { name: '', email: 'a@b.com' },
      token: 'tok',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects missing email', () => {
    const result = validateCheckout({
      items: [{ type: 'tea', id: 'tea-a', name: 'A', category: 'Green Tea', ounces: 2, pricePerOz: 3.50 }],
      customer: { name: 'A', email: '' },
      token: 'tok',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing payment token', () => {
    const result = validateCheckout({
      items: [{ type: 'tea', id: 'tea-a', name: 'A', category: 'Green Tea', ounces: 2, pricePerOz: 3.50 }],
      customer: { name: 'A', email: 'a@b.com' },
      token: '',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts valid checkout', () => {
    const result = validateCheckout({
      items: [{ type: 'tea', id: 'tea-a', name: 'A', category: 'Green Tea', ounces: 2, pricePerOz: 3.50 }],
      customer: { name: 'A', email: 'a@b.com' },
      token: 'tok',
    });
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module './checkout'

- [ ] **Step 3: Implement checkout.ts**

Create `src/lib/checkout.ts` with `validateCheckout()` and `buildSquareLineItems()` functions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Create API route**

Create `src/pages/api/checkout.ts`:
- `export const prerender = false;`
- POST handler: parse body, call `validateCheckout()`, build line items, create Square order + payment
- Error handling for Square API failures

- [ ] **Step 6: Commit**

```bash
git add src/lib/checkout.ts src/lib/checkout.test.ts src/pages/api/checkout.ts
git commit -m "feat: add checkout API route with validation tests"
```

---

## Task 10a: Configure Astro Hybrid Mode & Install Dependencies

**Files:**
- Modify: `astro.config.mjs` — set `output: 'hybrid'`, add `@astrojs/node` adapter
- Modify: `package.json` — add `square`, `@astrojs/node` dependencies
- Modify: `.gitignore` — add `.env`
- Create: `.env.example`

> **This must come before Tasks 10b and 11** — the API route needs hybrid mode and the Square SDK.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install square @astrojs/node
```

- [ ] **Step 2: Update astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://mumsteashop.com',
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Create .env.example**

```
SQUARE_ACCESS_TOKEN=your_sandbox_token_here
SQUARE_LOCATION_ID=your_location_id_here
SQUARE_APPLICATION_ID=your_sandbox_app_id_here
SQUARE_ENVIRONMENT=sandbox
```

- [ ] **Step 4: Add .env to .gitignore**

Append `.env` to `.gitignore`.

- [ ] **Step 5: Build to verify**

Run: `npm run build`
Expected: Build passes with hybrid mode

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs package.json package-lock.json .env.example .gitignore
git commit -m "chore: configure Astro hybrid mode with Node adapter and Square SDK"
```

---

## Task 10b: Build Checkout Page

**Files:**
- Create: `src/pages/checkout.astro`

> Depends on: Task 5 (cart-browser.ts), Task 10a (hybrid mode + Square SDK)

- [ ] **Step 1: Create checkout page shell — order summary**

Create `src/pages/checkout.astro` with:
- Page hero ("Checkout")
- Order summary section that reads cart items and renders them read-only with line totals and subtotal
- Empty-cart guard: if cart is empty, show message with link back to tea list

- [ ] **Step 2: Add customer info form**

Below the order summary, add:
- Name input (required)
- Email input (required)
- Phone input (optional)
- Form validation on submit

- [ ] **Step 3: Add Square card input and submit**

Add:
- `<div id="card-container"></div>` for Square SDK
- "Place Order" button
- Script that loads Square SDK from `https://sandbox.web.squarecdn.com/v1/square.js`
- Initialize with `sq.payments(applicationId, locationId)` where applicationId comes from a data attribute set from `import.meta.env.PUBLIC_SQUARE_APPLICATION_ID`
- On submit: validate form, tokenize card, POST to `/api/checkout`

- [ ] **Step 4: Add loading and success/error states**

- Loading spinner overlay during payment
- Success: show confirmation with order ID, clear cart
- Error: show message, re-enable button for retry

- [ ] **Step 5: Build and test**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 6: Commit**

```bash
git add src/pages/checkout.astro
git commit -m "feat: add checkout page with Square payment form"
```

---

## Task 11: TDD Checkout API Route

**Files:**
- Create: `src/lib/checkout.ts` — checkout validation + line item builder (pure functions, testable)
- Create: `src/lib/checkout.test.ts`
- Create: `src/pages/api/checkout.ts` — Astro API route (thin wrapper)

> Depends on: Task 10a (Square SDK installed, hybrid mode configured)

- [ ] **Step 1: Write failing tests for validateCheckout**

Create `src/lib/checkout.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test — verify fail**

Run: `npm test`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement validateCheckout**

Create `src/lib/checkout.ts`:
```typescript
import type { CartItem } from './cart';

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
```

- [ ] **Step 4: Run test — verify pass**

Run: `npm test`
Expected: validateCheckout tests PASS (buildSquareLineItems tests still fail — that's expected)

- [ ] **Step 5: Write failing tests for buildSquareLineItems**

Add to `checkout.test.ts`:
```typescript
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
```

- [ ] **Step 6: Run test — verify fail**

- [ ] **Step 7: Implement buildSquareLineItems**

Add to `src/lib/checkout.ts`:
```typescript
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
      return {
        name: `${item.name} (${item.ounces} oz)`,
        quantity: String(item.ounces),
        basePriceMoney: { amount: dollarsToCents(item.pricePerOz), currency: 'USD' },
      };
    }
    if (item.type === 'drink') {
      const opts = item.options;
      const note = `${opts.boba} boba, ${opts.milk}, ${opts.sweetness} sweet${opts.whip ? ', whipped cream' : ''}`;
      return {
        name: `${item.name} (${item.size})`,
        quantity: String(item.qty),
        basePriceMoney: { amount: dollarsToCents(item.price), currency: 'USD' },
        note,
      };
    }
    // product
    return {
      name: item.name,
      quantity: String((item as any).qty),
      basePriceMoney: { amount: dollarsToCents(item.price), currency: 'USD' },
    };
  });
}
```

- [ ] **Step 8: Run test — verify all pass**

Run: `npm test`
Expected: All checkout tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/checkout.ts src/lib/checkout.test.ts
git commit -m "feat: add checkout validation and Square line item builder with tests"
```

- [ ] **Step 10: Create API route**

Create `src/pages/api/checkout.ts`:
```typescript
import type { APIRoute } from 'astro';
import { Client, Environment } from 'square';
import { validateCheckout, buildSquareLineItems } from '../../lib/checkout';
import { randomUUID } from 'crypto';

export const prerender = false;

const client = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN,
  environment: import.meta.env.SQUARE_ENVIRONMENT === 'production'
    ? Environment.Production
    : Environment.Sandbox,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const validation = validateCheckout(body);

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lineItems = buildSquareLineItems(body.items);
    const idempotencyKey = randomUUID();
    const locationId = import.meta.env.SQUARE_LOCATION_ID;

    // Create order
    const orderResponse = await client.ordersApi.createOrder({
      order: {
        locationId,
        lineItems,
        fulfillments: [{
          type: 'PICKUP',
          state: 'PROPOSED',
          pickupDetails: {
            recipient: {
              displayName: body.customer.name,
              emailAddress: body.customer.email,
              phoneNumber: body.customer.phone || undefined,
            },
          },
        }],
      },
      idempotencyKey,
    });

    const orderId = orderResponse.result.order?.id;
    const totalMoney = orderResponse.result.order?.totalMoney;

    // Create payment
    const paymentResponse = await client.paymentsApi.createPayment({
      sourceId: body.token,
      idempotencyKey: randomUUID(),
      amountMoney: totalMoney!,
      orderId,
    });

    return new Response(JSON.stringify({
      success: true,
      orderId,
      total: totalMoney,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const message = err?.errors?.[0]?.detail || err?.message || 'Payment failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

- [ ] **Step 11: Build to verify**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 12: Commit**

```bash
git add src/pages/api/checkout.ts
git commit -m "feat: add Square checkout API route"
```

---

## Task 12: Final Integration & Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build passes — static pages + 1 SSR API route

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final integration verification"
```

---

## Execution Notes

- **TDD is mandatory.** Tasks 2, 3, and 11 follow strict red-green-refactor. No implementation code before a failing test.
- **Tasks 1-5** are foundational — must be done in order.
- **Tasks 6-9** (UI enhancements) can be parallelized after Task 5.
- **Task 10a** (hybrid mode + deps) must come before Tasks 10b and 11.
- **Task 10b** (checkout page) depends on Task 5 (cart-browser.ts) and Task 10a.
- **Task 11** (checkout API) depends on Task 10a.
- **Create `src/lib/` and `src/pages/api/` directories** before writing files there (`mkdir -p`).
- **The menu.json currently has only 16 teas** (was 225+ before deletion). Task 4 should restore the full tea list if possible, or the placeholder 16 teas work for development.
- **Square Application ID**: The checkout page needs `PUBLIC_SQUARE_APPLICATION_ID` as a public env var (Astro exposes `PUBLIC_` prefixed vars to client-side code). Add it to `.env.example`.
