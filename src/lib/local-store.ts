/**
 * A tiny external store over one localStorage key, for `useSyncExternalStore`. Reads are validated
 * by the caller-supplied parser, so a corrupt value reads as the fallback instead of breaking a page.
 */
export interface LocalStore<T> {
  readonly get: () => T;
  readonly set: (value: T) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly serverValue: () => T;
}

export function createLocalStore<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  function read(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return fallback;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = fallback;
      return cachedValue;
    }
    try {
      cachedValue = parse(JSON.parse(raw)) ?? fallback;
    } catch {
      cachedValue = fallback;
    }
    return cachedValue;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    get: read,
    serverValue: () => fallback,
    set(value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        cachedRaw = undefined;
        cachedValue = value;
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
