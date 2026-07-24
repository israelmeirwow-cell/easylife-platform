/**
 * Auth helpers wrapping the fastapi-users backend (cookie transport).
 *
 * The auth cookie is httponly + same-origin, so there is no token to store —
 * the browser carries it automatically once login sets it. Every call goes
 * through `api()` (which sends `credentials: 'include'`) except login, which
 * must be form-urlencoded (fastapi-users' login endpoint expects OAuth2
 * password-flow fields `username`/`password`, not JSON).
 */

import { api } from './api';

/**
 * Log in and set the auth cookie. fastapi-users' /login expects
 * `application/x-www-form-urlencoded` with `username` (the email) + `password`.
 * Throws on non-2xx so callers can surface a failure toast.
 */
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText);
  }
}

/**
 * Register a new tenant + owner. Returns the created user. Note: registration
 * does NOT log the user in — call `login()` afterward to obtain the cookie.
 */
export function register<T = unknown>(
  email: string,
  password: string,
  businessName: string,
): Promise<T> {
  return api<T>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, business_name: businessName }),
  });
}

/** Current user JSON if the cookie is valid; throws ApiError 401 otherwise. */
export function me<T = unknown>(): Promise<T> {
  return api<T>('/api/auth/me');
}

/** Clear the auth cookie. */
export function logout(): Promise<void> {
  return api<void>('/api/auth/logout', { method: 'POST' });
}
