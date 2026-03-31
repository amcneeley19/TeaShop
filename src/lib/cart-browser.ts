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
