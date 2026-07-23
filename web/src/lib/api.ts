/**
 * Thin fetch wrapper. baseURL is '' — in dev the Vite proxy forwards /api →
 * http://localhost:8000, in prod the SPA is served behind the same origin.
 * Auth is cookie-based, so every request carries credentials.
 *
 * DEMO MODE (build with VITE_DEMO=1): the app serves baked-in seed fixtures
 * instead of hitting a backend, so the dashboard runs as a standalone static
 * site (e.g. dropped on Netlify) with zero server. The `DEMO` const is a
 * compile-time constant, so a normal build dead-code-eliminates this branch.
 */

import demoFixtures from './demoFixtures.json';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '';
const DEMO = import.meta.env.VITE_DEMO === '1';
const FIXTURES = demoFixtures as Record<string, unknown>;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function demoResponse<T>(path: string, init: RequestInit): Promise<T> {
  await delay(180); // a touch of latency so skeletons/animations still show
  const method = (init.method ?? 'GET').toUpperCase();
  const clean = path.split('?')[0];

  // side-effectful / auth endpoints → benign mocked results
  if (clean === '/api/auth/login') return undefined as T;
  if (clean.endsWith('/connect'))
    return { mode: 'demo', message_he: 'זהו דמו — החיבורים לא פעילים כאן.' } as unknown as T;
  if (clean.endsWith('/disconnect')) return { ok: true } as unknown as T;

  // exact fixture (covers all list + summary + analytics + catalog + ceo)
  if (clean in FIXTURES) return FIXTURES[clean] as T;

  // /api/<coll>/:id → find inside the captured list
  const byId = clean.match(/^\/api\/(deals|contacts|accounts|tasks|tickets|leads)\/([^/]+)$/);
  if (byId) {
    const list = (FIXTURES[`/api/${byId[1]}`] as Array<{ id?: string }>) ?? [];
    const found = list.find((x) => x.id === byId[2]);
    if (found) return found as T;
  }

  // any timeline → reuse a captured sample timeline
  if (clean.endsWith('/timeline')) {
    const sample = Object.entries(FIXTURES).find(([k]) => k.endsWith('/timeline'));
    return (sample ? sample[1] : []) as T;
  }

  if (method !== 'GET') return undefined as T;
  return [] as unknown as T; // safe empty default
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (DEMO) return demoResponse<T>(path, init);

  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** True when running as the standalone demo build (no backend). */
export const IS_DEMO = DEMO;
