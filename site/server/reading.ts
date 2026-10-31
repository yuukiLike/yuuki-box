import { base64url, createRemoteJWKSet, customFetch, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { validProgress, validReadingPath } from '../src/lib/reading-progress.ts';

const appleIssuer = 'https://appleid.apple.com';
const sessionCookie = '__Host-yuuki-reading';
const flowCookie = '__Host-yuuki-apple-flow';
const sessionLifetime = 7 * 24 * 60 * 60;
const flowLifetime = 10 * 60;
const maxBodyBytes = 64 * 1024;

type Session = { account_id: string; token_hash: string };
type ProgressRow = { path: string; progress: number };

class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request: Request, name: string) {
  return request.headers.get('Cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function randomToken() {
  return base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
}

async function hash(value: string) {
  return base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function equalToken(left: string, right: unknown) {
  if (typeof right !== 'string') return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

function configured(env: ReadingEnv, requestUrl: URL) {
  if (!env.READING_DB || !env.SITE_ORIGIN || !env.APPLE_SERVICE_ID || !env.APPLE_TEAM_ID
    || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return false;
  try {
    const origin = new URL(env.SITE_ORIGIN);
    return origin.protocol === 'https:' && origin.origin === env.SITE_ORIGIN
      && origin.origin === requestUrl.origin && origin.pathname === '/'
      && !origin.search && !origin.hash && !origin.username && !origin.password
      && origin.hostname !== 'localhost' && !origin.hostname.startsWith('[')
      && !/^\d+(\.\d+){3}$/.test(origin.hostname);
  } catch { return false; }
}

function returnPath(value: string | null, origin: string) {
  if (!value || value.length > 2048 || !value.startsWith('/')) return '/';
  const url = new URL(value, origin);
  if (url.origin !== origin || url.pathname.startsWith('/api/')) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

function redirectAfterLogin(origin: string, path: string, error?: string) {
  const destination = new URL(returnPath(path, origin), origin);
  if (error) destination.searchParams.set('reading-auth', error);
  const response = new Response(null, { status: 303, headers: { Location: destination.href } });
  response.headers.append('Set-Cookie', cookie(flowCookie, '', 0));
  return response;
}

// Bound streamed bodies as well as requests with a Content-Length header.
async function readText(message: Request | Response, limit = maxBodyBytes) {
  if (Number(message.headers.get('Content-Length')) > limit) throw new RequestError(413, 'body_too_large');
  if (!message.body) return '';
  const reader = message.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError(413, 'body_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

async function readSession(request: Request, env: ReadingEnv): Promise<Session | null> {
  const token = readCookie(request, sessionCookie);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return env.READING_DB.prepare(
    'SELECT account_id, token_hash FROM reading_sessions WHERE token_hash = ? AND expires_at > ?',
  ).bind(await hash(token), Math.floor(Date.now() / 1000)).first<Session>();
}

async function startLogin(env: ReadingEnv, url: URL) {
  const state = randomToken();
  const nonce = randomToken();
  const flow = await new SignJWT({ state, nonce, returnTo: returnPath(url.searchParams.get('returnTo'), env.SITE_ORIGIN) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.SITE_ORIGIN).setAudience('yuuki-apple-flow').setIssuedAt()
    .setExpirationTime(`${flowLifetime}s`).sign(new TextEncoder().encode(env.SESSION_SECRET));
  const authorization = new URL(`${appleIssuer}/auth/authorize`);
  // Only request the account identifier. No name/email scope is needed, so a
  // query callback works with SameSite=Lax cookies, including Safari.
  authorization.search = new URLSearchParams({
    client_id: env.APPLE_SERVICE_ID,
    redirect_uri: `${env.SITE_ORIGIN}/api/reading/callback`,
    response_type: 'code', response_mode: 'query', state, nonce,
  }).toString();
  const response = new Response(null, { status: 302, headers: { Location: authorization.href } });
  response.headers.append('Set-Cookie', cookie(flowCookie, flow, flowLifetime));
  return response;
}

async function finishLogin(request: Request, env: ReadingEnv, url: URL) {
  let destination = '/';
  try {
    const flowToken = readCookie(request, flowCookie);
    if (!flowToken || flowToken.length > 8192) throw new RequestError(400, 'invalid_login_state');
    const { payload: flow } = await jwtVerify(flowToken, new TextEncoder().encode(env.SESSION_SECRET), {
      issuer: env.SITE_ORIGIN, audience: 'yuuki-apple-flow', algorithms: ['HS256'],
      requiredClaims: ['iat', 'exp', 'nonce', 'state', 'returnTo'], maxTokenAge: `${flowLifetime}s`,
    });
    if (typeof flow.state !== 'string' || typeof flow.nonce !== 'string' || typeof flow.returnTo !== 'string'
      || !equalToken(flow.state, url.searchParams.get('state'))) throw new RequestError(400, 'invalid_login_state');
    destination = returnPath(flow.returnTo, env.SITE_ORIGIN);
    if (url.searchParams.get('error') === 'user_cancelled_authorize') {
      return redirectAfterLogin(env.SITE_ORIGIN, destination, 'cancelled');
    }
    const code = url.searchParams.get('code');
    if (!code || code.length > 4096 || url.searchParams.has('error')) throw new RequestError(400, 'invalid_apple_response');

    const privateKey = await importPKCS8(env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256');
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID })
      .setIssuer(env.APPLE_TEAM_ID).setSubject(env.APPLE_SERVICE_ID).setAudience(appleIssuer)
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const tokenResponse = await fetch(`${appleIssuer}/auth/token`, {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.APPLE_SERVICE_ID, client_secret: clientSecret, code,
        grant_type: 'authorization_code', redirect_uri: `${env.SITE_ORIGIN}/api/reading/callback`,
      }),
    });
    if (!tokenResponse.ok) throw new RequestError(502, 'apple_token_exchange_failed');
    const tokens = JSON.parse(await readText(tokenResponse));
    if (typeof tokens.id_token !== 'string' || tokens.id_token.length > 16384) throw new RequestError(502, 'invalid_apple_response');
    const keys = createRemoteJWKSet(new URL(`${appleIssuer}/auth/keys`), {
      timeoutDuration: 8000,
      [customFetch]: async (input, options) => {
        const response = await fetch(input, options);
        return new Response(await readText(response), { status: response.status, headers: response.headers });
      },
    });
    const { payload } = await jwtVerify(tokens.id_token, keys, {
      issuer: appleIssuer, audience: env.APPLE_SERVICE_ID, algorithms: ['RS256'],
      requiredClaims: ['sub', 'iat', 'exp', 'nonce'], maxTokenAge: '10m',
    });
    if (!payload.sub || payload.sub.length > 256 || !equalToken(flow.nonce, payload.nonce)) {
      throw new RequestError(400, 'invalid_apple_identity');
    }

    // A stable Apple subject, rather than an email (which may be a relay address),
    // identifies the account. Only its digest is stored and returned to the site.
    const accountId = await hash(`${env.APPLE_TEAM_ID}:${payload.sub}`);
    const sessionToken = randomToken();
    const now = Math.floor(Date.now() / 1000);
    const previousToken = readCookie(request, sessionCookie);
    await env.READING_DB.batch([
      env.READING_DB.prepare('DELETE FROM reading_sessions WHERE expires_at <= ? OR token_hash = ?')
        .bind(now, previousToken ? await hash(previousToken) : ''),
      env.READING_DB.prepare('INSERT INTO reading_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
        .bind(await hash(sessionToken), accountId, now + sessionLifetime),
    ]);
    const response = redirectAfterLogin(env.SITE_ORIGIN, destination);
    response.headers.append('Set-Cookie', cookie(sessionCookie, sessionToken, sessionLifetime));
    return response;
  } catch (error) {
    // Never log authorization codes, tokens, cookies, email or private keys.
    console.warn(JSON.stringify({ event: 'reading.apple_login_failed', code: error instanceof RequestError ? error.code : 'verification_failed' }));
    return redirectAfterLogin(env.SITE_ORIGIN, destination, 'failed');
  }
}

async function getProgress(env: ReadingEnv, session: Session) {
  const rows = await env.READING_DB.prepare('SELECT path, progress FROM reading_progress WHERE account_id = ?')
    .bind(session.account_id).all<ProgressRow>();
  return Object.fromEntries(rows.results.map(({ path, progress }) => [path, progress]));
}

async function saveProgress(request: Request, env: ReadingEnv, session: Session) {
  let body;
  try { body = JSON.parse(await readText(request)); }
  catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'invalid_json');
  }
  if (!body || typeof body !== 'object' || body.accountId !== session.account_id) throw new RequestError(409, 'account_changed');
  if (!body.progress || typeof body.progress !== 'object' || Array.isArray(body.progress)) throw new RequestError(400, 'invalid_progress');
  const entries = Object.entries(body.progress);
  if (entries.length > 500 || entries.some(([path, progress]) => !validReadingPath(path) || !validProgress(progress))) {
    throw new RequestError(400, 'invalid_progress');
  }
  if (entries.length) {
    // One atomic UPSERT merges the whole upload. Concurrent devices cannot
    // overwrite a newer percentage with an older one.
    await env.READING_DB.prepare(`
      INSERT INTO reading_progress (account_id, path, progress, updated_at)
      SELECT ?, key, CAST(value AS INTEGER), ? FROM json_each(?) WHERE true
      ON CONFLICT(account_id, path) DO UPDATE SET
        progress = MAX(reading_progress.progress, excluded.progress),
        updated_at = CASE WHEN excluded.progress > reading_progress.progress
          THEN excluded.updated_at ELSE reading_progress.updated_at END
    `).bind(session.account_id, Math.floor(Date.now() / 1000), JSON.stringify(body.progress)).run();
  }
  return json({ accountId: session.account_id, progress: await getProgress(env, session) });
}

async function route(request: Request, env: ReadingEnv) {
  const url = new URL(request.url);
  const action = url.pathname.replace(/\/+$/, '').split('/').at(-1);
  const enabled = configured(env, url);
  if (action === 'session' && request.method === 'GET') {
    if (!enabled) return json({ enabled: false, accountId: null });
    const session = await readSession(request, env);
    return json({ enabled: true, accountId: session?.account_id ?? null });
  }
  if (!enabled) throw new RequestError(503, 'sync_not_configured');
  if (action === 'login' && request.method === 'GET') return startLogin(env, url);
  if (action === 'callback' && request.method === 'GET') return finishLogin(request, env, url);
  if (!['progress', 'logout'].includes(action ?? '')) throw new RequestError(404, 'not_found');
  if (request.method !== 'POST' && !(action === 'progress' && request.method === 'GET')) {
    throw new RequestError(405, 'method_not_allowed');
  }
  if (request.method === 'POST') {
    if (request.headers.get('Origin') !== env.SITE_ORIGIN) throw new RequestError(403, 'invalid_origin');
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
      throw new RequestError(415, 'json_required');
    }
  }
  const session = await readSession(request, env);
  if (action === 'logout') {
    if (session) await env.READING_DB.prepare('DELETE FROM reading_sessions WHERE token_hash = ?').bind(session.token_hash).run();
    const response = json({ ok: true });
    response.headers.append('Set-Cookie', cookie(sessionCookie, '', 0));
    return response;
  }
  if (!session) throw new RequestError(401, 'login_required');
  if (request.method === 'GET') return json({ accountId: session.account_id, progress: await getProgress(env, session) });
  return saveProgress(request, env, session);
}

export async function handleReadingRequest(request: Request, env: ReadingEnv) {
  let response: Response;
  try { response = await route(request, env); }
  catch (error) {
    if (error instanceof RequestError) response = json({ error: error.code }, error.status);
    else {
      console.error(JSON.stringify({ event: 'reading.request_failed', path: new URL(request.url).pathname }));
      response = json({ error: 'sync_unavailable' }, 503);
    }
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
