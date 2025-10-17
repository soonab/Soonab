// src/app/auth/page.tsx
import { redirect } from 'next/navigation';

export default function AuthIndexPage() {
  redirect('/auth/email');
}
