'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type StatusKind = 'idle' | 'loading' | 'success' | 'error';

export default function AuthRequestPage() {
  const params = useSearchParams();
  const redirect = useMemo(() => params?.get('redirect') || null, [params]);

  const [email, setEmail] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [link, setLink] = useState<string | null>(null);

  const googleHref = redirect
    ? `/api/auth/google?redirect=${encodeURIComponent(redirect)}`
    : '/api/auth/google';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusKind('loading');
    setStatusMessage('Sending a one-time link…');
    setLink(null);

    try {
      const res = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect }),
      });

      const data: { ok?: boolean; error?: string; link?: string } | null = await res
        .json()
        .catch(() => null);

      if (res.ok && data?.ok) {
        setStatusKind('success');
        setStatusMessage('Check your email for a sign-in link.');
        setLink(data.link || null);
        return;
      }

      const errorCode = data?.error;
      let message = 'We could not send a sign-in link. Please try again.';
      if (res.status === 429 || errorCode === 'rate_limited') {
        message = 'Too many attempts. Please wait a moment and try again.';
      } else if (errorCode === 'missing_email') {
        message = 'Please enter your email address.';
      }

      setStatusKind('error');
      setStatusMessage(message);
    } catch (err) {
      console.error('Failed to request sign-in link', err);
      setStatusKind('error');
      setStatusMessage('Network error. Check your connection and try again.');
    }
  }

  const isLoading = statusKind === 'loading';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in or create an account</h1>
        <p className="text-sm text-gray-500">
          We&apos;ll email you a secure one-time link. If you&apos;re new here we&apos;ll create
          your account as soon as you click it.
        </p>
      </div>

      <div className="space-y-4">
        <a href={googleHref} className="btn w-full justify-center">
          Continue with Google
        </a>
        <div className="text-center text-xs uppercase tracking-wide text-gray-500">or</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-gray-200" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-gray-700 bg-transparent p-2"
            autoComplete="email"
            required
          />
          <button
            type="submit"
            className="btn w-full justify-center"
            disabled={isLoading}
          >
            {isLoading ? 'Sending…' : 'Email me a magic link'}
          </button>
        </form>
        <div aria-live="polite" className="min-h-[1.5rem]">
          {statusKind !== 'idle' && statusMessage && (
            <p
              className={
                statusKind === 'error'
                  ? 'text-sm text-red-400'
                  : 'text-sm text-gray-400'
              }
            >
              {statusMessage}
            </p>
          )}
        </div>
        {link && (
          <p className="text-sm text-gray-500">
            Dev link:{' '}
            <a className="underline" href={link}>
              {link}
            </a>
          </p>
        )}
        <p className="text-xs text-gray-500">
          We never post without your permission. Sign in to follow, reply, and
          keep track of the people you trust.
        </p>
      </div>
    </main>
  );
}
