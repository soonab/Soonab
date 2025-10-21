'use client';

// Simple client-side CSRF helper.
// - Grabs /api/csrf once per session (sets cookie + returns token)
// - apiFetch() adds `x-csrf` header automatically
// - If a request returns 403, it refreshes the token once and retries

let csrfToken: string | null = null;

async function fetchToken(force = false): Promise<string> {
  if (!force && csrfToken) return csrfToken;
  const res = await fetch('/api/csrf', {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to fetch CSRF token');
  const data = (await res.json()) as { token: string };
  csrfToken = data.token;
  return csrfToken!;
}

export async function getCsrf(): Promise<string> {
  return fetchToken(false);
}

export async function refreshCsrf(): Promise<string> {
  csrfToken = null;
  return fetchToken(true);
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, _retry = true): Promise<Response> {
  const token = await getCsrf();
  const headers = new Headers(init.headers || {});
  headers.set('x-csrf', token);

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  // If token drifted (e.g., sign-in state changed), refresh once and retry.
  if (res.status === 403 && _retry) {
    const newToken = await refreshCsrf();
    const retryHeaders = new Headers(init.headers || {});
    retryHeaders.set('x-csrf', newToken);
    return fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: 'same-origin',
    });
  }

  return res;
}
