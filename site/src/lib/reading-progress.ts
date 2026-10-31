export const anonymousPrefix = 'yuuki-reading-progress:';
export const activeAccountKey = 'yuuki-reading-active-account';
const accountPrefix = 'yuuki-reading-account:';

export function readingPath(path: string): string {
  return decodeURIComponent(path).replace(/\/+$/, '') || '/';
}

export function validProgress(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}

export function validReadingPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && path.length <= 1024
    && !/[\u0000-\u001f\u007f?#\\]/.test(path)
    && !['/', '/index', '/404'].includes(path) && !path.startsWith('/api/');
}

export function createReadingStore(storage: Storage | null, onError: () => void) {
  // Memory also retains progress when localStorage is unavailable or full.
  const memory = new Map<string, number>();
  let accountId: string | null = null;
  try {
    const saved = storage?.getItem(activeAccountKey);
    if (saved && /^[A-Za-z0-9_-]{43}$/.test(saved)) accountId = saved;
  } catch { onError(); }

  const prefix = (account = accountId) => account ? `${accountPrefix}${account}:` : anonymousPrefix;

  function get(path: string, account = accountId) {
    const key = prefix(account) + path;
    let value = memory.get(key) ?? 0;
    try {
      const saved = Number(storage?.getItem(key));
      if (validProgress(saved)) value = Math.max(value, saved);
    } catch { onError(); }
    return value;
  }

  function set(path: string, progress: number) {
    if (!validReadingPath(path) || !validProgress(progress) || progress <= get(path)) return;
    const key = prefix() + path;
    memory.set(key, progress);
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(key, String(progress));
    } catch { onError(); }
  }

  function entries(account = accountId): Record<string, number> {
    const values: Record<string, number> = {};
    const currentPrefix = prefix(account);
    const add = (key: string) => {
      if (!key.startsWith(currentPrefix)) return;
      const path = key.slice(currentPrefix.length);
      const progress = get(path, account);
      if (validReadingPath(path) && validProgress(progress)) values[path] = progress;
    };
    try {
      if (storage) for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key) add(key);
      }
    } catch { onError(); }
    memory.forEach((_, key) => add(key));
    return values;
  }

  function useAccount(nextAccount: string | null) {
    accountId = nextAccount;
    try {
      if (!storage) throw new Error('Storage unavailable');
      if (nextAccount) storage.setItem(activeAccountKey, nextAccount);
      else storage.removeItem(activeAccountKey);
    } catch { onError(); }
  }

  function importAnonymous() {
    if (!accountId) return;
    for (const [path, progress] of Object.entries(entries(null))) {
      set(path, progress);
      // Move a guest record only after its account cache is safely written.
      try {
        if (Number(storage?.getItem(prefix() + path)) < progress || !storage) continue;
        storage.removeItem(anonymousPrefix + path);
        memory.delete(anonymousPrefix + path);
      } catch { onError(); }
    }
  }

  return {
    get accountId() { return accountId; },
    get storagePrefix() { return prefix(); },
    get, set, entries, useAccount, importAnonymous,
  };
}
