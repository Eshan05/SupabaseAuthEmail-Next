'use client';

import { redirect } from 'next/navigation';

export default function SignInPage() {
  redirect('/u/auth?mode=signin');
}