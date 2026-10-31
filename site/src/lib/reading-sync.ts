import { createReadingStore, validProgress, validReadingPath } from './reading-progress.ts';

type Store = ReturnType<typeof createReadingStore>;
type Status = 'checking' | 'local' | 'disabled' | 'syncing' | 'pending' | 'synced' | 'expired' | 'error' | 'logout-error';

export function createReadingSync(store: Store, onChange: () => void, fetcher: typeof fetch = fetch) {
  let status: Status = 'checking';
  let enabled = false;
  let authenticated = false;
  let version = 0;
  let inFlightVersion: number | null = null;
  const pending = new Map<string, number>();

  function changed(next: Status) {
    status = next;
    onChange();
  }

  function recorded(path: string) {
    if (!store.accountId) return;
    const progress = store.get(path);
    if (!validProgress(progress)) return;
    pending.set(path, progress);
    if (authenticated && inFlightVersion !== version) changed('pending');
  }

  async function flush(keepalive = false) {
    if (!authenticated || !store.accountId || inFlightVersion === version) return;
    const accountId = store.accountId;
    const requestVersion = version;
    inFlightVersion = requestVersion;
    changed('syncing');
    try {
      // Small batches also fit the browser's keepalive body limit on page exit.
      for (let batch = 0; batch < 10; batch++) {
        const upload = Object.fromEntries([...pending].slice(0, 40));
        const hasUpload = Object.keys(upload).length > 0;
        const response = await fetcher('/api/reading/progress', {
          method: hasUpload ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', keepalive,
          signal: AbortSignal.timeout(10000),
          ...(hasUpload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, progress: upload }) } : {}),
        });
        if (requestVersion !== version) return;
        if (response.status === 401 || response.status === 409) {
          authenticated = false;
          changed('expired');
          return;
        }
        if (!response.ok) throw new Error('Sync failed');
        const result: unknown = await response.json();
        if (requestVersion !== version) return;
        if (!result || typeof result !== 'object' || !('accountId' in result) || result.accountId !== accountId
          || !('progress' in result) || !result.progress || typeof result.progress !== 'object' || Array.isArray(result.progress)) {
          throw new Error('Invalid sync response');
        }
        for (const [path, progress] of Object.entries(result.progress)) {
          if (validReadingPath(path) && validProgress(progress)) store.set(path, progress);
        }
        for (const [path, progress] of Object.entries(upload)) {
          if (pending.get(path) === progress) pending.delete(path);
        }
        onChange();
        if (!pending.size || keepalive) break;
      }
      changed(pending.size ? 'pending' : 'synced');
    } catch {
      if (requestVersion === version) changed('error');
    } finally { if (inFlightVersion === requestVersion) inFlightVersion = null; }
  }

  async function refresh() {
    const requestVersion = ++version;
    authenticated = false;
    changed('checking');
    try {
      const response = await fetcher('/api/reading/session', {
        credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      if (requestVersion !== version) return;
      if (response.status === 404) { enabled = false; changed('disabled'); return; }
      if (!response.ok) throw new Error('Session check failed');
      const session: unknown = await response.json();
      if (requestVersion !== version) return;
      if (!session || typeof session !== 'object' || !('enabled' in session) || typeof session.enabled !== 'boolean'
        || !('accountId' in session) || !(session.accountId === null || typeof session.accountId === 'string' && /^[A-Za-z0-9_-]{43}$/.test(session.accountId))) {
        throw new Error('Invalid session response');
      }
      enabled = session.enabled;
      if (!enabled) { changed('disabled'); return; }
      if (!session.accountId) { changed(store.accountId ? 'expired' : 'local'); return; }
      store.useAccount(session.accountId);
      store.importAnonymous();
      pending.clear();
      Object.entries(store.entries()).forEach(([path, progress]) => pending.set(path, progress));
      authenticated = true;
      onChange();
      await flush();
    } catch {
      if (requestVersion === version) changed('error');
    }
  }

  function signedOut() {
    version++;
    authenticated = false;
    pending.clear();
    store.useAccount(null);
    changed(enabled ? 'local' : 'disabled');
  }

  async function logout() {
    // A failed request must leave the local account and its pending data intact.
    version++;
    authenticated = false;
    try {
      const response = await fetcher('/api/reading/logout', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Logout failed');
      signedOut();
    } catch { changed('logout-error'); }
  }

  return {
    get status() { return status; },
    get enabled() { return enabled; },
    get authenticated() { return authenticated; },
    get accountId() { return store.accountId; },
    recorded, refresh, flush, logout, signedOut,
  };
}
