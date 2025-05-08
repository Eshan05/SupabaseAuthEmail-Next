import { logger } from '@/lib/logger';
const LOG_PREFIX = '[RateLimitFetch]';

export const runtime = 'edge';

/**
 * Calls the internal rate limit API route to check the limit.
 * @param identifier The identifier (email/username/IP) to check.
 * @param limitType The type of rate limit to apply.
 * @returns True if limited, false otherwise. Includes error status if fetch fails.
 */
export async function applyRateLimitViaApi(
  identifier: string,
  limitType: string // Keep as string to pass to API
): Promise<{ limited: boolean; error?: Error }> {
  const apiUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/rate-limit`;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, limitType }),
    });

    if (!response.ok) {
      // Handle HTTP errors (including 429 from the API route)
      const body = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
      const message = body.message || `Rate limit API error: ${response.status}`;

      if (response.status === 429) {
        logger.warn(`${LOG_PREFIX} Rate limit exceeded via API for ${identifier}: ${message}`);
        return { limited: true, error: new Error(message) };
      } else {
        logger.error(`${LOG_PREFIX} Error calling rate limit API for ${identifier}: ${response.status} - ${message}`);
        return { limited: true, error: new Error(message) }; // Default to limiting if API fails
      }
    }

    const body = await response.json();
    return { limited: !body.allowed, error: undefined };

  } catch (error) {
    logger.error(`${LOG_PREFIX} Network/fetch error calling rate limit API for ${identifier}:`, error);
    // Default to limiting if there's a network error
    return { limited: true, error: new Error('Rate limit check failed due to network error.') };
  }
}