import assert from 'node:assert/strict';
import test from 'node:test';
import { activeAccountKey, anonymousPrefix, createReadingStore, readingPath } from '../src/lib/reading-progress.ts';
import { createReadingSync } from '../src/lib/reading-sync.ts';

const accountA = 'A'.repeat(43);
const accountB = 'B'.repeat(43);

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function storeWithGuest(progress = {}) {
  const storage = new MemoryStorage();
  Object.entries(progress).forEach(([path, value]) => storage.setItem(anonymousPrefix + path, value));
  const store = createReadingStore(storage, () => {});
  return { store, storage };
}

test('legacy records move into the signed-in cache while account and guest histories stay separate', () => {
  const { store, storage } = storeWithGuest({ '/guide': 65 });
  assert.equal(readingPath('/%E4%B8%AD%E6%96%87///'), '/中文');
  assert.equal(store.get('/guide'), 65);
  store.useAccount(accountA);
  store.importAnonymous();
  assert.equal(store.get('/guide'), 65);
  assert.equal(storage.getItem(anonymousPrefix + '/guide'), null);
  store.set('/guide', 90);
  store.set('/guide', 20);
  assert.equal(store.get('/guide'), 90);
  store.useAccount(accountB);
  store.importAnonymous();
  assert.deepEqual(store.entries(), {});
  store.set('/other', 45);
  store.useAccount(null);
  assert.deepEqual(store.entries(), {});
  store.useAccount(accountA);
  assert.deepEqual(store.entries(), { '/guide': 90 });
  assert.equal(createReadingStore(storage, () => {}).accountId, accountA);
  storage.setItem(activeAccountKey, 'invalid-account');
  assert.equal(createReadingStore(storage, () => {}).accountId, null);
});

test('storage failure keeps new progress in memory and does not delete unmigrated guest data', () => {
  const storage = new MemoryStorage();
  storage.setItem(anonymousPrefix + '/guide', 60);
  storage.setItem = () => { throw new Error('Storage full'); };
  let errors = 0;
  const store = createReadingStore(storage, () => { errors++; });
  store.useAccount(accountA);
  store.importAnonymous();
  assert.equal(store.get('/guide'), 60);
  assert.equal(storage.getItem(anonymousPrefix + '/guide'), '60');
  store.set('/guide', 85);
  assert.equal(store.get('/guide'), 85);
  assert.ok(errors > 0);
  const memoryOnly = createReadingStore(null, () => {});
  memoryOnly.set('/guide', 35);
  assert.deepEqual(memoryOnly.entries(), { '/guide': 35 });
});

test('anonymous progress is imported only after authentication and cloud progress never decreases the cache', async () => {
  const { store } = storeWithGuest({ '/guide': 40 });
  let loggedIn = false;
  const uploads = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: loggedIn ? accountA : null });
    uploads.push(JSON.parse(options.body));
    return Response.json({ accountId: accountA, progress: { '/guide': 75, '/other': 100 } });
  });
  await sync.refresh();
  assert.equal(sync.status, 'local');
  assert.equal(store.accountId, null);
  assert.equal(uploads.length, 0);
  loggedIn = true;
  await sync.refresh();
  assert.deepEqual(uploads[0], { accountId: accountA, progress: { '/guide': 40 } });
  assert.deepEqual(store.entries(), { '/guide': 75, '/other': 100 });
  assert.equal(sync.status, 'synced');
});

test('failed uploads retain pending progress and a later retry uploads the same values', async () => {
  const { store } = storeWithGuest();
  let offline = false;
  const uploads = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: accountA });
    if (offline) throw new TypeError('Network unavailable');
    if (options.body) uploads.push(JSON.parse(options.body));
    return Response.json({ accountId: accountA, progress: options.body ? JSON.parse(options.body).progress : {} });
  });
  await sync.refresh();
  store.set('/guide', 80);
  sync.recorded('/guide');
  offline = true;
  await sync.flush();
  assert.equal(sync.status, 'error');
  assert.equal(store.get('/guide'), 80);
  offline = false;
  await sync.flush();
  assert.deepEqual(uploads, [{ accountId: accountA, progress: { '/guide': 80 } }]);
  assert.equal(sync.status, 'synced');
});

test('progress recorded during an upload is sent afterward instead of being cleared', async () => {
  const { store } = storeWithGuest();
  const delayed = Promise.withResolvers();
  const uploads = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: accountA });
    if (!options.body) return Response.json({ accountId: accountA, progress: {} });
    const upload = JSON.parse(options.body);
    uploads.push(upload.progress['/guide']);
    if (uploads.length === 1) return delayed.promise;
    return Response.json({ accountId: accountA, progress: upload.progress });
  });
  await sync.refresh();
  store.set('/guide', 60);
  sync.recorded('/guide');
  const uploading = sync.flush();
  store.set('/guide', 90);
  sync.recorded('/guide');
  delayed.resolve(Response.json({ accountId: accountA, progress: { '/guide': 60 } }));
  await uploading;
  assert.deepEqual(uploads, [60, 90]);
  assert.equal(store.get('/guide'), 90);
  assert.equal(sync.status, 'synced');
});

test('switching accounts ignores an old in-flight response and never uploads the old account cache', async () => {
  const { store } = storeWithGuest();
  let currentAccount = accountA;
  const delayed = Promise.withResolvers();
  const uploads = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: currentAccount });
    if (options.body) { uploads.push(JSON.parse(options.body)); return delayed.promise; }
    return Response.json({ accountId: currentAccount, progress: { [currentAccount === accountA ? '/guide' : '/other']: 30 } });
  });
  await sync.refresh();
  store.set('/guide', 80);
  sync.recorded('/guide');
  const oldUpload = sync.flush();
  currentAccount = accountB;
  await sync.refresh();
  assert.deepEqual(store.entries(), { '/other': 30 });
  delayed.resolve(Response.json({ accountId: accountA, progress: { '/guide': 80 } }));
  await oldUpload;
  assert.equal(store.accountId, accountB);
  assert.deepEqual(store.entries(), { '/other': 30 });
  assert.deepEqual(uploads, [{ accountId: accountA, progress: { '/guide': 80 } }]);
  store.useAccount(accountA);
  assert.equal(store.get('/guide'), 80);
});

test('expired or changed sessions stop uploads until the account is checked again', async () => {
  const { store } = storeWithGuest();
  let reject = false;
  const uploads = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: accountA });
    if (reject) return Response.json({ error: 'account_changed' }, { status: 409 });
    if (options.body) uploads.push(JSON.parse(options.body));
    return Response.json({ accountId: accountA, progress: options.body ? JSON.parse(options.body).progress : {} });
  });
  await sync.refresh();
  store.set('/guide', 80);
  sync.recorded('/guide');
  reject = true;
  await sync.flush();
  assert.equal(sync.status, 'expired');
  assert.equal(sync.authenticated, false);
  assert.equal(store.get('/guide'), 80);
  reject = false;
  await sync.flush();
  assert.equal(uploads.length, 0);
  await sync.refresh();
  assert.deepEqual(uploads[0].progress, { '/guide': 80 });
});

test('failed logout preserves the account; successful logout ignores pending responses and restores guest storage', async () => {
  const { store } = storeWithGuest();
  let failLogout = true;
  const delayed = Promise.withResolvers();
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: accountA });
    if (url.endsWith('/logout')) return Response.json({}, { status: failLogout ? 503 : 200 });
    if (options.body) return delayed.promise;
    return Response.json({ accountId: accountA, progress: {} });
  });
  await sync.refresh();
  store.set('/guide', 80);
  sync.recorded('/guide');
  const uploading = sync.flush();
  await sync.logout();
  assert.equal(sync.status, 'logout-error');
  assert.equal(store.accountId, accountA);
  assert.equal(store.get('/guide'), 80);
  failLogout = false;
  await sync.logout();
  delayed.resolve(Response.json({ accountId: accountA, progress: { '/guide': 80 } }));
  await uploading;
  assert.equal(sync.status, 'local');
  assert.equal(store.accountId, null);
  assert.deepEqual(store.entries(), {});
  store.useAccount(accountA);
  assert.equal(store.get('/guide'), 80);
});

test('large guest histories are uploaded in bounded batches', async () => {
  const history = Object.fromEntries(Array.from({ length: 85 }, (_, index) => [`/document-${index}`, 50]));
  const { store } = storeWithGuest(history);
  const batchSizes = [];
  const sync = createReadingSync(store, () => {}, async (url, options) => {
    if (url.endsWith('/session')) return Response.json({ enabled: true, accountId: accountA });
    const body = JSON.parse(options.body);
    batchSizes.push(Object.keys(body.progress).length);
    return Response.json({ accountId: accountA, progress: body.progress });
  });
  await sync.refresh();
  assert.deepEqual(batchSizes, [40, 40, 5]);
  assert.equal(Object.keys(store.entries()).length, 85);
  assert.equal(sync.status, 'synced');
});

test('unconfigured or static-only previews preserve guest data and show disabled sync', async () => {
  for (const response of [Response.json({ enabled: false, accountId: null }), new Response('', { status: 404 })]) {
    const { store } = storeWithGuest({ '/guide': 55 });
    const sync = createReadingSync(store, () => {}, async () => response);
    await sync.refresh();
    assert.equal(sync.status, 'disabled');
    assert.equal(store.accountId, null);
    assert.equal(store.get('/guide'), 55);
  }
});
