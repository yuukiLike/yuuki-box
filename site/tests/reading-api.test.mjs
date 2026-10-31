import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { handleReadingRequest } from '../server/reading.ts';

const origin = 'https://docs.example.test';
const appleKeys = await generateKeyPair('RS256');
const appKeys = await generateKeyPair('ES256', { extractable: true });
const applePublicKey = { ...await exportJWK(appleKeys.publicKey), kid: 'apple-test-key', alg: 'RS256', use: 'sig' };
const appPrivateKey = await exportPKCS8(appKeys.privateKey);

// Execute the real migration and handler SQL against SQLite rather than imitating
// the merge in a mock. Only the D1 transport is adapted for the Node test runner.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_reading_progress.sql', import.meta.url), 'utf8'));
  function prepare(query) {
    const statement = sqlite.prepare(query);
    let values = [];
    return {
      bind(...next) { values = next; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values), success: true }; },
      async run() { statement.run(...values); return { success: true }; },
    };
  }
  return {
    sqlite, prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

function fixture(t) {
  const db = database();
  t.after(() => db.sqlite.close());
  const env = {
    READING_DB: db, SITE_ORIGIN: origin, APPLE_SERVICE_ID: 'test.docs.web', APPLE_TEAM_ID: 'TESTTEAM',
    APPLE_KEY_ID: 'TESTKEY', APPLE_PRIVATE_KEY: appPrivateKey, SESSION_SECRET: 'a-test-only-secret-with-more-than-32-characters',
  };
  function request(action, { cookie, method = 'GET', body, headers = {} } = {}) {
    return new Request(`${origin}/api/reading/${action}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
  }
  const call = (action, options) => handleReadingRequest(request(action, options), env);
  return { db, env, call, request };
}

function responseCookie(response, name) {
  return response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`))?.split(';')[0];
}

function mockApple(t, claims = {}, invalidSignature = false) {
  let nonce = '';
  let exchanges = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = String(input);
    if (url === 'https://appleid.apple.com/auth/keys') return Response.json({ keys: [applePublicKey] });
    assert.equal(url, 'https://appleid.apple.com/auth/token');
    exchanges++;
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('redirect_uri'), `${origin}/api/reading/callback`);
    await jwtVerify(form.get('client_secret'), appKeys.publicKey, {
      issuer: 'TESTTEAM', audience: 'https://appleid.apple.com', subject: 'test.docs.web', algorithms: ['ES256'],
    });
    const now = Math.floor(Date.now() / 1000);
    let token = await new SignJWT({
      iss: 'https://appleid.apple.com', aud: 'test.docs.web', sub: 'apple-user-a', nonce, iat: now, exp: now + 3600, ...claims,
    }).setProtectedHeader({ alg: 'RS256', kid: 'apple-test-key' }).sign(appleKeys.privateKey);
    if (invalidSignature) {
      const parts = token.split('.');
      parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
      token = parts.join('.');
    }
    return Response.json({ id_token: token, access_token: 'not-stored', refresh_token: 'not-stored' });
  });
  return { setNonce(value) { nonce = value; }, get exchanges() { return exchanges; } };
}

async function login(context, apple, cookie) {
  const start = await context.call('login?returnTo=%2Fguide%2F%23next', { cookie });
  const authorization = new URL(start.headers.get('Location'));
  apple.setNonce(authorization.searchParams.get('nonce'));
  const flow = responseCookie(start, '__Host-yuuki-apple-flow');
  const callback = await context.call(`callback?code=apple-test-code&state=${authorization.searchParams.get('state')}`, {
    cookie: [flow, cookie].filter(Boolean).join('; '),
  });
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('Location'), `${origin}/guide/#next`);
  const session = responseCookie(callback, '__Host-yuuki-reading');
  assert.ok(session);
  const identity = await (await context.call('session', { cookie: session })).json();
  return { cookie: session, accountId: identity.accountId };
}

test('missing configuration and preview origins disable sync without requiring login', async (t) => {
  const { request, env } = fixture(t);
  const disabled = await handleReadingRequest(request('session'), {});
  assert.deepEqual(await disabled.json(), { enabled: false, accountId: null });
  const preview = await handleReadingRequest(new Request('https://preview.example.test/api/reading/session'), env);
  assert.deepEqual(await preview.json(), { enabled: false, accountId: null });
  const login = await handleReadingRequest(request('login'), {});
  assert.equal(login.status, 503);
  assert.equal(login.headers.get('Cache-Control'), 'no-store');
});

test('login uses state/nonce and a secure cookie, and refuses external return URLs', async (t) => {
  const context = fixture(t);
  for (const returnTo of ['//evil.example/path', '/\\evil.example/path', 'https://evil.example/path', '/api/reading/login']) {
    const response = await context.call(`login?returnTo=${encodeURIComponent(returnTo)}`);
    const destination = new URL(response.headers.get('Location'));
    assert.equal(destination.origin, 'https://appleid.apple.com');
    assert.equal(destination.searchParams.get('response_type'), 'code');
    assert.equal(destination.searchParams.get('response_mode'), 'query');
    assert.equal(destination.searchParams.has('scope'), false);
    assert.equal(destination.searchParams.get('state').length, 43);
    assert.equal(destination.searchParams.get('nonce').length, 43);
    const setCookie = response.headers.get('Set-Cookie');
    assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/);
    const token = responseCookie(response, '__Host-yuuki-apple-flow').split('=')[1];
    const { payload } = await jwtVerify(token, new TextEncoder().encode(context.env.SESSION_SECRET));
    assert.equal(payload.returnTo, '/');
  }
});

test('the same Apple account shares max progress across devices while another account stays isolated', async (t) => {
  const context = fixture(t);
  const apple = mockApple(t);
  const deviceA = await login(context, apple);
  const deviceB = await login(context, apple);
  assert.equal(deviceA.accountId, deviceB.accountId);
  assert.notEqual(deviceA.cookie, deviceB.cookie);
  const stored = context.db.sqlite.prepare('SELECT token_hash FROM reading_sessions').get();
  assert.notEqual(stored.token_hash, deviceA.cookie.split('=')[1]);

  const save = (device, progress) => context.call('progress', {
    cookie: device.cookie, method: 'POST', body: { accountId: device.accountId, progress: { '/guide': progress } },
  });
  assert.equal((await save(deviceA, 40)).status, 200);
  const reading = await (await context.call('progress', { cookie: deviceB.cookie })).json();
  assert.equal(reading.progress['/guide'], 40);
  await Promise.all([save(deviceB, 85), save(deviceA, 60), save(deviceB, 95), save(deviceA, 70)]);
  assert.equal((await (await save(deviceA, 50)).json()).progress['/guide'], 95);

  t.mock.restoreAll();
  const otherApple = mockApple(t, { sub: 'apple-user-b' });
  const other = await login(context, otherApple);
  assert.notEqual(other.accountId, deviceA.accountId);
  assert.deepEqual((await (await context.call('progress', { cookie: other.cookie })).json()).progress, {});
  const forgedAccount = await context.call('progress', {
    cookie: other.cookie, method: 'POST', body: { accountId: deviceA.accountId, progress: { '/guide': 100 } },
  });
  assert.equal(forgedAccount.status, 409);

  const logout = await context.call('logout', { cookie: deviceA.cookie, method: 'POST', body: {} });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await save(deviceA, 100)).status, 401);
  assert.equal((await context.call('progress', { cookie: deviceB.cookie })).status, 200);
});

test('wrong state, expired flow and cancelled login create no session', async (t) => {
  const context = fixture(t);
  const apple = mockApple(t);
  t.mock.method(console, 'warn', () => {});
  const start = await context.call('login?returnTo=/guide/');
  const flow = responseCookie(start, '__Host-yuuki-apple-flow');
  const authorization = new URL(start.headers.get('Location'));
  const wrong = await context.call('callback?code=test&state=wrong', { cookie: flow });
  assert.match(wrong.headers.get('Location'), /reading-auth=failed/);
  const missing = await context.call('callback?code=test&state=wrong');
  assert.match(missing.headers.get('Location'), /reading-auth=failed/);
  const expired = await new SignJWT({ state: 's', nonce: 'n', returnTo: '/guide/' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer(origin).setAudience('yuuki-apple-flow')
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) - 1)
    .sign(new TextEncoder().encode(context.env.SESSION_SECRET));
  const expiredResponse = await context.call('callback?code=test&state=s', { cookie: `__Host-yuuki-apple-flow=${expired}` });
  assert.match(expiredResponse.headers.get('Location'), /reading-auth=failed/);
  const cancelled = await context.call(`callback?error=user_cancelled_authorize&state=${authorization.searchParams.get('state')}`, { cookie: flow });
  assert.equal(cancelled.headers.get('Location'), `${origin}/guide/?reading-auth=cancelled`);
  assert.equal(apple.exchanges, 0);
  assert.equal(context.db.sqlite.prepare('SELECT COUNT(*) AS total FROM reading_sessions').get().total, 0);
});

test('identity signatures, audience, issuer, nonce and expiry are verified', async (t) => {
  const invalidClaims = [
    [{ aud: 'another-app' }], [{ iss: 'https://evil.example' }], [{ nonce: 'wrong-nonce' }],
    [{ exp: Math.floor(Date.now() / 1000) - 1 }], [{ sub: '' }], [{}, true],
  ];
  for (const [claims, invalidSignature] of invalidClaims) {
    await t.test(invalidSignature ? 'invalid signature' : JSON.stringify(claims), async (subtest) => {
      const context = fixture(subtest);
      const apple = mockApple(subtest, claims, invalidSignature);
      subtest.mock.method(console, 'warn', () => {});
      const start = await context.call('login');
      const authorization = new URL(start.headers.get('Location'));
      apple.setNonce(authorization.searchParams.get('nonce'));
      const response = await context.call(`callback?code=test&state=${authorization.searchParams.get('state')}`, {
        cookie: responseCookie(start, '__Host-yuuki-apple-flow'),
      });
      assert.match(response.headers.get('Location'), /reading-auth=failed/);
      assert.equal(responseCookie(response, '__Host-yuuki-reading'), undefined);
      assert.equal(context.db.sqlite.prepare('SELECT COUNT(*) AS total FROM reading_sessions').get().total, 0);
    });
  }
});

test('writes require a session, same-origin JSON and valid bounded progress', async (t) => {
  const context = fixture(t);
  const device = await login(context, mockApple(t));
  const good = { accountId: device.accountId, progress: { '/guide': 30 } };
  const post = (body = good, headers = {}) => context.call('progress', { cookie: device.cookie, method: 'POST', body, headers });
  assert.equal((await context.call('progress', { method: 'POST', body: good })).status, 401);
  assert.equal((await post(good, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(good, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await context.call('progress', { cookie: device.cookie, method: 'PUT' })).status, 405);
  assert.equal((await post('{invalid')).status, 400);
  assert.equal((await post('x'.repeat(65537))).status, 413);
  for (const progress of [0, -1, 101, 3.5, '40', null, true]) {
    assert.equal((await post({ accountId: device.accountId, progress: { '/guide': progress } })).status, 400);
  }
  for (const path of ['/', '//evil.example', '/api/reading/session', '/guide?x', '/guide#x', '/bad\npath']) {
    assert.equal((await post({ accountId: device.accountId, progress: { [path]: 50 } })).status, 400);
  }
  const tooMany = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`/doc-${i}`, 1]));
  assert.equal((await post({ accountId: device.accountId, progress: tooMany })).status, 400);
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).progress, { '/guide': 30 });
  const token = device.cookie.split('=')[1];
  context.db.sqlite.prepare('UPDATE reading_sessions SET expires_at = 0 WHERE token_hash = ?')
    .run(createHash('sha256').update(token).digest('base64url'));
  assert.equal((await post()).status, 401);
});
