'use client';

import { redirect } from 'next/navigation';

export default function SignUpPage() {
  redirect('/u/auth?mode=signup');
}