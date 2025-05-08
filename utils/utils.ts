import { redirect } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/database.types';

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: 'error' | 'success',
  path: string,
  message: string,
  additionalParams: Record<string, string> = {} // See actions.ts
) {
  const queryParams = new URLSearchParams({
    [type]: encodeURIComponent(message),
    ...additionalParams,
  })

  return redirect(`${path}?${queryParams}`)
}

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach((key) => delete result[key])
  return result
}

export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toLowerCase());
}

export function parseJwt(token: string | null) {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
}

export const createRedirectWithClearedCookies = (
  url: URL,
  request: NextRequest
): NextResponse => {
  const redirectResponse = NextResponse.redirect(url);
  console.log(`[Middleware] Clearing cookies and redirecting to ${url.pathname}`);
  const cookieOptions = { path: '/', maxAge: 0 };
  redirectResponse.cookies.set('sb-access-token', '', cookieOptions);
  redirectResponse.cookies.set('sb-refresh-token', '', cookieOptions);
  redirectResponse.cookies.set('authToken', '', cookieOptions);
  const prefix = process.env.SUPABASE_COOKIE_PREFIX || 'sb';
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith(`${prefix}-`)) {
      redirectResponse.cookies.set(cookie.name, '', cookieOptions);
    }
  });

  return redirectResponse;
};

const ADMIN_CACHE_COOKIE_NAME = 'app-admin-status';
const ADMIN_CACHE_MAX_AGE_SECONDS = 5 * 60;

async function checkAdminStatus(
  userId: string | undefined,
  supabaseClient: ReturnType<typeof createServerClient<Database>>,
  request: NextRequest,
  response: NextResponse
): Promise<{ isAdmin: boolean; response: NextResponse }> {
  if (!userId) {
    return { isAdmin: false, response };
  }

  const cachedAdminStatus = request.cookies.get(ADMIN_CACHE_COOKIE_NAME)?.value;
  if (cachedAdminStatus === 'true') {
    console.log("[Middleware][checkAdminStatus] Admin role confirmed via cache cookie.");
    return { isAdmin: true, response };
  }
  // if (cachedAdminStatus === 'false') {
  //     console.log("[Middleware][checkAdminStatus] Non-admin status confirmed via cache cookie.");
  //     return { isAdmin: false, response };
  // }

  console.log(`[Middleware][checkAdminStatus] Cache miss for user ${userId}. Calling DB function 'is_admin'...`);
  let isAdmin = false;

  try {
    const { data, error } = await supabaseClient
      .rpc('is_admin', { check_user_id: userId });

    if (error) {
      console.error("[Middleware][checkAdminStatus] Error calling 'is_admin' function:", error);
      isAdmin = false;
    } else {
      isAdmin = data === true;
      console.log(`[Middleware][checkAdminStatus] DB function 'is_admin' result: ${isAdmin}`);
    }
  } catch (rpcCatchError) {
    console.error("[Middleware][checkAdminStatus] Unexpected error during RPC call:", rpcCatchError);
    isAdmin = false;
  }

  if (isAdmin) {
    console.log("[Middleware][checkAdminStatus] Setting admin cache cookie.");
    response.cookies.set(ADMIN_CACHE_COOKIE_NAME, 'true', {
      path: '/',
      maxAge: ADMIN_CACHE_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  else if (cachedAdminStatus !== 'false') { // Only set 'false' if not already set
    console.log("[Middleware][checkAdminStatus] Setting non-admin cache cookie.");
    response.cookies.set(ADMIN_CACHE_COOKIE_NAME, 'false', {
      path: '/',
      maxAge: ADMIN_CACHE_MAX_AGE_SECONDS, // Cache negative result too
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    });
  }

  return { isAdmin, response };
}