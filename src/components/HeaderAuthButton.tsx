import Link from 'next/link';
import { getAuthedUserId } from '@/lib/auth';

export default async function HeaderAuthButton() {
  const uid = await getAuthedUserId();
  return uid ? (
    <Link href="/me" className="btn-ghost">My profile</Link>
  ) : (
    <Link href="/login" className="btn">Sign in</Link>
  );
}
