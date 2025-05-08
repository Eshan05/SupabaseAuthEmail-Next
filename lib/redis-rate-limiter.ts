import { redis } from './redis';
import { NextRequest } from 'next/server';

// --- Configuration ---
// Define different limiter configurations
interface RateLimitConfig {
  keyPrefix: string;
  capacity: number; // Max tokens (burst capacity)
  refillRate: number; // Tokens added per second
  windowSeconds: number; // Used to derive refillRate if not specified, or just for context
}

export const RateLimitConfigs = {
  GENERAL_IP: {
    keyPrefix: 'rl:ip',
    capacity: 100,
    refillRate: 100 / 60, // 100 tokens / 60 seconds
    windowSeconds: 60,
  },
  SENSITIVE_IDENTIFIER: {
    keyPrefix: 'rl:id',
    capacity: 5,
    refillRate: 5 / (5 * 60), // 5 tokens / 300 seconds
    windowSeconds: 5 * 60,
  },
  API_HEAVY_ENDPOINT: {
    keyPrefix: 'rl:api_heavy',
    capacity: 20,
    refillRate: 20 / 60, // 20 tokens / 60 seconds
    windowSeconds: 60,
  }
} as const;

export type RateLimitType = keyof typeof RateLimitConfigs;

// --- Lua Script for Token Bucket ---
// KEYS[1] = Unique key for the user/ip
// ARGV[1] = Bucket capacity (Max tokens)
// ARGV[2] = Refill rate (Tokens per second)
// ARGV[3] = Current timestamp (Seconds)
// ARGV[4] = Tokens to consume (Usually 1)
// Returns: 1 if allowed, 0 if denied
const LUA_SCRIPT = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local current_tokens = tonumber(data[1])
    local last_refill = tonumber(data[2])

    -- Initialize if key doesn't exist
    if current_tokens == nil then
        current_tokens = capacity
        last_refill = now
    end

    -- Calculate tokens to add since last refill
    local elapsed = math.max(0, now - last_refill)
    local tokens_to_add = elapsed * refill_rate

    -- Update token count, capped at capacity
    current_tokens = math.min(capacity, current_tokens + tokens_to_add)

    -- Update last refill time
    last_refill = now -- Always update last_refill time

    local allowed = 0 -- 0 = denied by default
    if current_tokens >= requested then
        current_tokens = current_tokens - requested
        allowed = 1 -- 1 = allowed
    end

    -- Save updated state
    redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', last_refill)
    -- Set expiry only needs to happen once conceptually, or periodically
    -- Set expiry slightly longer than the time it takes to fully refill the bucket
    local expiry_seconds = math.ceil(capacity / refill_rate) * 2 -- Double expiry for safety buffer
    redis.call('EXPIRE', key, expiry_seconds)

    return allowed
`;

// --- Helper Function to Run the Limiter ---
interface RateLimitResult {
  allowed: boolean;
  remaining: number; // Approximate remaining tokens (calculated client-side for info)
  error?: Error;
}

// Cache the SHA1 hash of the script for efficiency using EVALSHA
let scriptSha: string | null = null;

async function loadScript(): Promise<string> {
  if (scriptSha) return scriptSha;
  try {
    scriptSha = await redis.script('LOAD', LUA_SCRIPT) as string;
    console.log('[Rate Limiter] Loaded Lua script SHA:', scriptSha);
    return scriptSha;
  } catch (error) {
    console.error('[Rate Limiter] Failed to load Lua script:', error);
    throw new Error('Could not load rate limiter script.');
  }
}

/**
 * Checks and consumes tokens for a given identifier against a specific limit configuration.
 * Uses the Token Bucket algorithm implemented in Redis Lua script.
 *
 * @param identifier Unique string identifying the entity being limited (e.g., IP address, user ID, email).
 * @param limitType The type of limit configuration to apply (e.g., 'GENERAL_IP').
 * @param tokensToConsume Number of tokens to consume for this request (default: 1).
 * @returns Promise<RateLimitResult>
 */
export async function checkRedisRateLimit(
  identifier: string,
  limitType: RateLimitType,
  tokensToConsume: number = 1
): Promise<RateLimitResult> {
  const config = RateLimitConfigs[limitType];
  if (!config) {
    console.error(`[Rate Limiter] Invalid limitType specified: ${limitType}`);
    // Fail open or closed? Failing closed (denying) is often safer for rate limits.
    return { allowed: false, remaining: 0, error: new Error("Invalid rate limit type.") };
  }

  const key = `${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  try {
    const sha = await loadScript(); // Ensure script is loaded

    const result = await redis.evalsha(
      sha,
      1, // Number of keys
      key, // KEYS[1]
      config.capacity.toString(), // ARGV[1]
      config.refillRate.toString(), // ARGV[2]
      now.toString(), // ARGV[3]
      tokensToConsume.toString() // ARGV[4]
    ) as (0 | 1); // Lua returns number; cast to 0 or 1
    const allowed = result === 1;
    // Note: Calculating 'remaining' accurately client-side is tricky due to potential
    // concurrent requests. This is just an informational estimate.
    // For a rough estimate, we can fetch the tokens AFTER the check.
    // const currentData = allowed ? await redisConnection.hget(key, 'tokens') : '0';
    // const remainingEstimate = allowed ? parseFloat(currentData || '0') : 0;
    if (!allowed) {
      console.warn(`[Rate Limiter] Denied request for ${identifier} using limit ${limitType}.`);
    }

    return {
      allowed: allowed,
      remaining: -1, // Indicate remaining is not accurately calculated here
      error: undefined
    };

  } catch (error) {
    // Handle case where script SHA is no longer valid (EX: Redis restart without persistence)
    if (error instanceof Error && error.message.includes('NOSCRIPT')) {
      console.warn('[Rate Limiter] Lua script SHA not found, attempting to reload...');
      scriptSha = null; // Clear cached SHA
      return checkRedisRateLimit(identifier, limitType, tokensToConsume); // Retry the operation
    }

    console.error(`[Rate Limiter] Error checking limit for ${identifier} (${limitType}):`, error);
    // Decide whether to fail open (allow) or closed (deny) if Redis fails.
    // Failing open might be acceptable for temporary Redis issues but riskier.
    // Failing closed is safer for preventing abuse.
    return {
      allowed: false, // Fail closed
      remaining: 0,
      error: new Error('Rate limiter failed.')
    };
  }
}


// --- Integration Helper for API Routes/Middleware ---

// Applies rate limiting based on IP address for general requests.
export async function applyIpRateLimit(req: NextRequest, limitType: RateLimitType = 'GENERAL_IP'): Promise<{ limited: boolean; error?: Error }> {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown_ip';
  if (ip === 'unknown_ip') {
    console.warn('[Rate Limiter] Could not determine IP address.');
    // Decide how to handle unknown IPs - block or allow? Blocking is safer.
    return { limited: true, error: new Error("Could not determine IP address.") };
  }
  const result = await checkRedisRateLimit(ip, limitType);
  return { limited: !result.allowed, error: result.error };
}

// Applies rate limiting based on a specific identifier for sensitive actions.
export async function applyIdentifierRateLimit(identifier: string, limitType: RateLimitType = 'SENSITIVE_IDENTIFIER'): Promise<{ limited: boolean; error?: Error }> {
  if (!identifier) {
    return { limited: true, error: new Error("Identifier required for this rate limit.") };
  }
  const result = await checkRedisRateLimit(identifier, limitType);
  return { limited: !result.allowed, error: result.error };
}