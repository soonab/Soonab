// src/app/login/page.tsx
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="max-w-md mx-auto space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-gray-600 mt-1">Choose a method to continue.</p>
        <div className="mt-4 space-y-2">
          <a href="/api/auth/google" className="btn w-full justify-center">
            Continue with Google
          </a>
          <a href="/auth/email" className="btn-ghost w-full justify-center">
            Continue with email
          </a>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        By continuing you agree to our terms and privacy policy.
      </p>
    </main>
  );
}
