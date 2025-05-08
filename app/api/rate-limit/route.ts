import { NextResponse } from 'next/server';
import { checkRedisRateLimit, RateLimitConfigs } from '@/lib/redis-rate-limiter';
import type { RateLimitType } from '@/lib/redis-rate-limiter';
import { logger } from '@/lib/logger';

const LOG_PREFIX = '[RateLimitAPI]';

export async function POST(req: Request) {
  try {
    const { identifier, limitType } = await req.json();

    if (typeof identifier !== 'string' || typeof limitType !== 'string') {
      return NextResponse.json({ error: 'Invalid input: identifier and limitType are required strings.' }, { status: 400 });
    }

    if (!(limitType in RateLimitConfigs)) {
      return NextResponse.json({ error: `Invalid limitType: ${limitType}` }, { status: 400 });
    }

    const result = await checkRedisRateLimit(identifier, limitType as RateLimitType);

    if (result.error) {
      logger.error(`${LOG_PREFIX} Internal error checking rate limit for ${identifier}:`, result.error);
      return NextResponse.json({ allowed: false, message: 'Rate limit check failed.' }, { status: 500 });
    }

    if (!result.allowed) {
      logger.warn(`${LOG_PREFIX} Rate limit exceeded for ${identifier} (${limitType}).`);
      return NextResponse.json({ allowed: false, message: 'Rate limit exceeded.' }, { status: 429 });
    }

    return NextResponse.json({ allowed: true });

  } catch (error) {
    logger.error(`${LOG_PREFIX} Unexpected error in rate limit API route:`, error);
    return NextResponse.json({ allowed: false, message: 'Internal Server Error.' }, { status: 500 });
  }
}