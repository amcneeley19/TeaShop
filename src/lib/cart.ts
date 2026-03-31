// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Update changes type ──────────────────────────────────────────────────────

type ItemChanges = {
  ounces?: number;
  qty?: number;
  price?: number;
  size?: '12oz' | '16oz';
};

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateTeaOunces(ounces: number): void {
  if (ounces <= 0 || ounces > 16) {
    throw new Error(`Tea ounces must be between 1 and 16, got ${ounces}`);
  }
}

function validateDrinkQty(qty: number): void {
  if (qty <= 0 || qty > 10) {
    throw new Error(`Drink qty must be between 1 and 10, got ${qty}`);
  }
}

function validateProductQty(qty: number): void {
  if (qty <= 0 || qty > 10) {
    throw new Error(`Product qty must be between 1 and 10, got ${qty}`);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCart(storage: CartStorage, notifier: CartNotifier) {
  // Load initial state from storage, handling null or corrupted data gracefully
  let items: CartItem[] = [];
  try {
    const loaded = storage.load();
    if (Array.isArray(loaded)) {
      items = loaded;
    }
  } catch {
    // Corrupted storage — start with empty cart
    items = [];
  }

  function persist(): void {
    storage.save([...items]);
    notifier.notify();
  }

  function addItem(item: CartItem): void {
    if (item.type === 'tea') {
      validateTeaOunces(item.ounces);
      const existing = items.find((i) => i.id === item.id) as TeaCartItem | undefined;
      if (existing) {
        existing.ounces = Math.min(16, existing.ounces + item.ounces);
      } else {
        items.push({ ...item });
      }
    } else if (item.type === 'drink') {
      validateDrinkQty(item.qty);
      const existing = items.find((i) => i.id === item.id) as DrinkCartItem | undefined;
      if (existing) {
        existing.qty = Math.min(10, existing.qty + item.qty);
      } else {
        items.push({ ...item });
      }
    } else if (item.type === 'product') {
      validateProductQty(item.qty);
      const existing = items.find((i) => i.id === item.id) as ProductCartItem | undefined;
      if (existing) {
        existing.qty = Math.min(10, existing.qty + item.qty);
      } else {
        items.push({ ...item });
      }
    }
    persist();
  }

  function removeItem(id: string): void {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return; // no-op
    items.splice(index, 1);
    persist();
  }

  function updateItem(id: string, changes: ItemChanges): void {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (item.type === 'tea') {
      if (changes.ounces !== undefined) {
        validateTeaOunces(changes.ounces);
        item.ounces = changes.ounces;
      }
      if (changes.price !== undefined) {
        item.pricePerOz = changes.price;
      }
    } else if (item.type === 'drink') {
      if (changes.qty !== undefined) {
        validateDrinkQty(changes.qty);
        item.qty = changes.qty;
      }
      if (changes.size !== undefined) {
        item.size = changes.size;
      }
      if (changes.price !== undefined) {
        item.price = changes.price;
      }
    } else if (item.type === 'product') {
      if (changes.qty !== undefined) {
        validateProductQty(changes.qty);
        item.qty = changes.qty;
      }
      if (changes.price !== undefined) {
        item.price = changes.price;
      }
    }

    persist();
  }

  function getCart(): CartItem[] {
    // Return a shallow copy of the array (items themselves are still references,
    // but the array is a new instance so callers can't mutate the list).
    return [...items];
  }

  function getSubtotal(): number {
    return items.reduce((sum, item) => {
      if (item.type === 'tea') return sum + item.ounces * item.pricePerOz;
      if (item.type === 'drink') return sum + item.qty * item.price;
      if (item.type === 'product') return sum + item.qty * item.price;
      return sum;
    }, 0);
  }

  function getItemCount(): number {
    return items.length;
  }

  function clearCart(): void {
    items = [];
    persist();
  }

  return { addItem, removeItem, updateItem, getCart, getSubtotal, getItemCount, clearCart };
}
