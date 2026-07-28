// Node 22+/25 ships an experimental built-in `localStorage` global that shadows
// jsdom's `window.localStorage`. Without a valid `--localstorage-file` path it is
// inert — `getItem`/`setItem` are missing — so any module that touches
// localStorage at import time (e.g. src/i18n) throws under vitest. Install a
// deterministic in-memory Storage on globalThis BEFORE such modules load.
//
// This file MUST be imported first in the vitest setup chain.

class MemoryStorage {
  #store = new Map();

  get length() {
    return this.#store.size;
  }

  key(index) {
    return Array.from(this.#store.keys())[index] ?? null;
  }

  getItem(key) {
    const k = String(key);
    return this.#store.has(k) ? this.#store.get(k) : null;
  }

  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }

  removeItem(key) {
    this.#store.delete(String(key));
  }

  clear() {
    this.#store.clear();
  }
}

if (typeof globalThis.localStorage?.getItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}
