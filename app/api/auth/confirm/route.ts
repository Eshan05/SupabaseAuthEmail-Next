import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[Confirm Route] Received GET request (Post-Supabase Confirmation).');

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const type = searchParams.get('type');
  console.log(`[Confirm Route] Params received: token=${token ? 'present' : 'missing'}, type=${type}`);

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = '';

  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('[Confirm Route] Error fetching user after confirmation redirect:', userError);
    redirectTo.pathname = '/u/signin';
    redirectTo.searchParams.set('error', 'Failed to retrieve user session after confirmation.');
    return NextResponse.redirect(redirectTo);
  }

  if (user && user.email_confirmed_at) {
    console.log(`[Confirm Route] User ${user.id} confirmed. Redirecting to onboarding.`);
    redirectTo.pathname = '/u/onboard';
    redirectTo.searchParams.set('verified', 'true');
    return NextResponse.redirect(redirectTo);
  } else if (user && !user.email_confirmed_at) {
    console.warn(`[Confirm Route] User ${user.id} found, but email_confirmed_at is still null. Possible timing issue or flow error.`);
    redirectTo.pathname = '/u/signin';
    redirectTo.searchParams.set('error', 'Verification process incomplete. Please try signing in or resending confirmation.');
    return NextResponse.redirect(redirectTo);
  }
  else {
    console.warn('[Confirm Route] No user session found after confirmation redirect.');
    redirectTo.pathname = '/u/signin';
    redirectTo.searchParams.set('error', 'Confirmation successful, but failed to establish session. Please sign in.');
    return NextResponse.redirect(redirectTo);
  }
}