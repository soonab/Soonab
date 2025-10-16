// Server component: reads cookies on the server
import Link from 'next/link';
import { getAuthedUserId } from '@/lib/auth';

type Props = { force?: boolean }; // set force to true if you want to see it even when signed in

export default async function LoginCtaCard({ force = false }: Props) {
  const uid = await getAuthedUserId();
  if (!force && uid) return null; // hide when logged-in (unless forced)

  return (
    <div className="card p-4 border rounded-lg">
      <h3 className="font-semibold">Create an account</h3>
      <p className="text-sm text-gray-600 mt-1">
        Sign in to post, reply, and follow. No public counts—just people.
      </p>
      <div className="mt-3">
        <Link href="/login" className="btn">Continue with Google / Email</Link>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Private, secure cookies. No tracking.
      </p>
    </div>
  );
}
