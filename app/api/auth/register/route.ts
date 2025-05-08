import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { signUpSchema, SignUpInput } from '@/lib/zod.auth';
import { applyIpRateLimit, applyIdentifierRateLimit } from '@/lib/redis-rate-limiter';
import { ZodError } from 'zod';
import { AuthApiError } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown_ip';
  console.log(`[API Route] Received signup request from IP: ${ip}`);

  const ipRateLimitResult = await applyIpRateLimit(request, 'GENERAL_IP');
  if (ipRateLimitResult.limited) {
    console.warn(`[API Route] IP rate limited: ${ip}`);
    return NextResponse.json({ message: 'Too many requests from this IP address.' }, { status: 429 });
  }

  let data: SignUpInput;
  try {
    data = await request.json();
    signUpSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('[API Route] Zod validation error:', error.errors);
      return NextResponse.json({ message: 'Invalid input data.', errors: error.errors }, { status: 400 });
    }
    console.error('[API Route] Failed to parse request body:', error);
    return NextResponse.json({ message: 'Invalid request format.' }, { status: 400 });
  }

  const { email, username, password } = data;

  const emailRateLimitResult = await applyIdentifierRateLimit(email.toLowerCase(), 'SENSITIVE_IDENTIFIER');
  if (emailRateLimitResult.limited) {
    console.warn(`[API Route] Email rate limited: ${email}`);
    return NextResponse.json({ message: 'Too many sign-up attempts for this email.' }, { status: 429 });
  }
  const usernameRateLimitResult = await applyIdentifierRateLimit(username.toLowerCase(), 'SENSITIVE_IDENTIFIER');
  if (usernameRateLimitResult.limited) {
    console.warn(`[API Route] Username rate limited: ${username}`);
    return NextResponse.json({ message: 'Too many sign-up attempts for this username.' }, { status: 429 });
  }


  if (process.env.FF_DISABLE_SIGNUP === 'true') {
    console.warn('[API Route] Signup disabled via feature flag.');
    return NextResponse.json({ message: 'Sign-up is currently disabled. Please try again later.' }, { status: 503 });
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username, // Store username in auth.users.user_metadata
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`,
    }
  });

  if (authError) {
    console.error('[API Route] Supabase Auth Error:', authError);
    if (authError instanceof AuthApiError) {
      if (authError.status === 400) {
        if (authError.message.includes('Email already registered') || authError.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
          return NextResponse.json({ message: 'Email already registered.' }, { status: 409 });
        }
        if (authError.message.includes('duplicate key value violates unique constraint "users_username_key"')) {
          return NextResponse.json({ message: 'Username already exists.' }, { status: 409 });
        }
        if (authError.message.includes('Password should be at least')) {
          return NextResponse.json({ message: authError.message }, { status: 400 });
        }
      }
      return NextResponse.json({ message: authError.message || 'Sign-up failed.' }, { status: authError.status || 500 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred during sign-up.' }, { status: 500 });
  }

  console.log(`[API Route] User created in auth.users. Email verification sent to ${email}`);
  const redirectUrl = `/u/signin?signup=success&verifyEmail=true&email=${encodeURIComponent(email)}`;
  return NextResponse.json(
    { message: 'Account created successfully! Please check your email to confirm.', redirectUrl: redirectUrl },
    { status: 200 }
  );
}