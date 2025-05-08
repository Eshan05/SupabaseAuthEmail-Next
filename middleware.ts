import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient, updateSession } from '@/utils/supabase/middleware'
import { AuthError } from '@supabase/supabase-js';
import {
  PUBLIC_ROUTES,
  AUTH_ROUTES_PREFIX,
  AUTH_PAGES,
  ONBOARDING_ROUTE,
  ERROR_ROUTE,
  API_AUTH_CONFIRM_ROUTE,
  PROTECTED_ROUTES_PREFIXES,
  ADMIN_ROUTES_PREFIXES,
  FEATURE_ROUTES,
  isPathForDisabledFeature,
  isFullMaintenanceMode,
  isPartialMaintenanceMode,
} from '@/lib/config/paths'
import { createRedirectWithClearedCookies } from '@/utils/utils';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const MAINTENANCE_PAGE = '/maintenance';
  const partialMaintenanceActive = isPartialMaintenanceMode();
  console.log(`[Middleware] Processing path: ${pathname}`);

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') && pathname !== API_AUTH_CONFIRM_ROUTE ||
    pathname.includes('.')
  ) {
    console.log('[Middleware] Allowing static asset or non-auth API route.');
    return NextResponse.next();
  }

  // --- Initialize Supabase Client and Response ---
  // Note: createMiddlewareClient returns the *initial* response object.
  // Any subsequent modifications (like redirects or setting cookies later)
  // need to use the latest 'response' object or create a new one.
  const { supabase, response: initialResponse } = createMiddlewareClient(request);
  let currentResponse = initialResponse;

  if (isFullMaintenanceMode()) {
    if (pathname !== '/maintenance') {
      console.log('[Middleware] Full Maintenance Mode: Redirecting.');
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
    return currentResponse;
  }

  const { data: { user }, error: getUserError } = await supabase.auth.getUser();

  if (getUserError && getUserError instanceof AuthError) {
    console.error("[Middleware] AuthError fetching user:", getUserError.message);
    if (AUTH_PAGES.includes(pathname)) {
      console.warn("[Middleware] Invalid session on auth page. Allowing request but clearing cookies.");
      const cookieOptions = { path: '/', maxAge: 0 };
      currentResponse.cookies.set('sb-access-token', '', cookieOptions);
      currentResponse.cookies.set('sb-refresh-token', '', cookieOptions);
      currentResponse.cookies.set('authToken', '', cookieOptions);
      return currentResponse;
    } else {
      const redirectUrl = new URL('/u/signin', request.url);
      redirectUrl.searchParams.set('error', 'Your session is invalid. Please sign in again.');
      return createRedirectWithClearedCookies(redirectUrl, request);
    }
  } else if (getUserError) {
    console.error("[Middleware] Non-AuthError fetching user:", getUserError);
    if (pathname !== ERROR_ROUTE) {
      return NextResponse.redirect(new URL(ERROR_ROUTE + '?code=MW_USER_FETCH_FAIL', request.url));
    }
  }

  const isAuthenticated = !!user;
  let isOnboardingComplete: boolean | null = null;

  // --- Determine Route Type ---
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAuthRoute = AUTH_PAGES.includes(pathname);
  const isOnboardingRoute = pathname === ONBOARDING_ROUTE;
  const isApiConfirmRoute = pathname === API_AUTH_CONFIRM_ROUTE;
  const isGeneralProtectedRoute = PROTECTED_ROUTES_PREFIXES.some(p => pathname.startsWith(p));
  const isDisabledFeatureRoute = isPathForDisabledFeature(pathname);

  if (isAuthenticated && isDisabledFeatureRoute) {
    console.log(`[Middleware] Access denied to disabled feature route: ${pathname}`);
    return NextResponse.redirect(new URL('/dashboard?message=Feature+Temporarily+Disabled', request.url));
  }

  if (isAuthenticated) {
    console.log(`[Middleware] User ${user.id} is authenticated.`);

    // Redirect authenticated users away from auth pages
    if (isAuthRoute) {
      console.log('[Middleware] Authenticated user on auth page. Redirecting to dashboard.');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // --- Onboarding Check (Fetch only if necessary) ---
    if (isGeneralProtectedRoute || isOnboardingRoute || isDisabledFeatureRoute === false) {
      console.log('[Middleware] Fetching onboarding status for user:', user.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[Middleware] Error fetching profile:', profileError);
        if (pathname !== ERROR_ROUTE) {
          const errorRedirect = new URL(ERROR_ROUTE + '?code=MW_PROFILE_FETCH_FAIL', request.url);
          return NextResponse.redirect(errorRedirect);
        }
      } else {
        isOnboardingComplete = profile?.onboarding_complete ?? false;
        console.log(`[Middleware] Onboarding complete: ${isOnboardingComplete}`);
      }
    }

    // --- Onboarding Redirects (only if status was fetched) ---
    if (isOnboardingComplete !== null) {
      if (isOnboardingRoute && isOnboardingComplete === true) {
        console.log('[Middleware] User already onboarded, redirecting from onboarding page.');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      // Redirect to onboarding if trying to access protected/feature routes but not complete
      if ((isGeneralProtectedRoute || (isDisabledFeatureRoute === false && !isPublicRoute && !isOnboardingRoute)) && isOnboardingComplete === false) {
        console.log('[Middleware] User not onboarded, redirecting to onboarding page.');
        return NextResponse.redirect(new URL(ONBOARDING_ROUTE, request.url));
      }
    }
    // --- End Onboarding Check ---

    // If authenticated, onboarded (or not needed), allow access
    console.log(`[Middleware] Allowing authenticated user access to: ${pathname}`);
    return currentResponse;

  } else {
    console.log('[Middleware] User is not authenticated.');

    // Allow access to public routes, auth routes, and API confirm route
    if (isPublicRoute || isAuthRoute || isApiConfirmRoute) {
      console.log(`[Middleware] Allowing unauthenticated access to public/auth route: ${pathname}`);
      return currentResponse;
    }

    console.log(`[Middleware] Unauthenticated user accessing protected route: ${pathname}. Redirecting to signin.`);
    const redirectUrl = new URL('/u/signin', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
