import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { signInSchema } from '@/lib/zod.auth';
import { ZodError } from 'zod';
import { AuthApiError } from '@supabase/supabase-js';
import { applyIpRateLimit, applyIdentifierRateLimit } from '@/lib/redis-rate-limiter';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown_ip';
  console.log(`[API Signin] Request from IP: ${ip}`);

  const ipRateLimitResult = await applyIpRateLimit(request, 'GENERAL_IP');
  if (ipRateLimitResult.limited) {
    console.warn(`[API Signin] IP rate limited: ${ip}`);
    return NextResponse.json({ ok: false, error: 'Too many requests from this IP.' }, { status: 429 });
  }

  let parsedData;
  try {
    const rawData = await request.json();
    parsedData = signInSchema.parse(rawData);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid input.', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { identifier, password } = parsedData;

  const idRateLimitResult = await applyIdentifierRateLimit(identifier.toLowerCase(), 'SENSITIVE_IDENTIFIER');
  if (idRateLimitResult.limited) {
    console.warn(`[API Signin] Identifier rate limited: ${identifier}`);
    return NextResponse.json({ ok: false, error: 'Too many sign-in attempts for this user.' }, { status: 429 });
  }

  const supabase = await createClient();
  let userEmail: string | null = null;

  try {
    const isLikelyEmail = identifier.includes('@');

    if (isLikelyEmail) {
      userEmail = identifier;
      console.log(`[API Signin] Identifier looks like email: ${userEmail}`);
    } else {
      console.log(`[API Signin] Identifier looks like username: ${identifier}. Looking up email...`);
      // Username is unique by default
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id') // Select ID to get email from auth.users
        .eq('username', identifier) // Match against the username column
        .single();

      if (profileError || !profile) {
        console.warn(`[API Signin] Username lookup failed for: ${identifier}`, profileError);
        return NextResponse.json({ ok: false, error: 'Invalid credentials.', error_code: 'INVALID_CREDENTIALS' }, { status: 401 });
      }

      const supabaseAdmin = await createClient(true);
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

      if (userError || !userData?.user?.email) {
        console.error(`[API Signin] Failed to get user email for ID: ${profile.id}`, userError);
        return NextResponse.json({ ok: false, error: 'Failed to retrieve user data.', error_code: 'INTERNAL_ERROR' }, { status: 500 });
      }
      userEmail = userData.user.email;
      console.log(`[API Signin] Found email for username ${identifier}: ${userEmail}`);
    }

    if (!userEmail) {
      // Safety check
      return NextResponse.json({ ok: false, error: 'Could not determine email.', error_code: 'INTERNAL_ERROR' }, { status: 500 });
    }

    // --- Attempt Sign In with Supabase ---
    console.log(`[API Signin] Attempting signInWithPassword for email: ${userEmail}`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: password,
    });

    if (signInError) {
      console.error(`[API Signin] Supabase signIn error for ${userEmail}:`, signInError);
      if (signInError instanceof AuthApiError) {
        if (signInError.message.includes('Email not confirmed')) {
          return NextResponse.json({
            ok: false,
            error: 'Email not confirmed. Please check your inbox.',
            error_code: 'EMAIL_NOT_CONFIRMED',
            email: userEmail
          }, { status: 401 });
        }
        if (signInError.message.includes('Invalid login credentials')) {
          // This covers wrong password or non-existent email after lookup
          return NextResponse.json({ ok: false, error: 'Invalid credentials.', error_code: 'INVALID_CREDENTIALS' }, { status: 401 });
        }
        return NextResponse.json({ ok: false, error: signInError.message, error_code: 'SUPABASE_AUTH_ERROR' }, { status: signInError.status || 400 });
      }
      return NextResponse.json({ ok: false, error: 'An unexpected authentication error occurred.', error_code: 'UNEXPECTED_AUTH_ERROR' }, { status: 500 });
    }

    console.log(`[API Signin] Sign in successful for ${userEmail}`);
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error('[API Signin] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'An internal server error occurred.', error_code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}